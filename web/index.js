// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import path from "path";
import serveStatic from "serve-static";
import mongoose, { ObjectId } from "mongoose";
import dotenv from "dotenv";
import _ from "lodash";
import Shop from "./models/shop.model.js";

import shopify from "./shopify.js";
import webhookHandlers from "./webhook-handlers.js";
import axios from "axios";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";

import { ApiVersion, DeliveryMethod, LATEST_API_VERSION } from "@shopify/shopify-api";
import shopModel from "./models/shop.model.js";
import moment from "moment";
import productModel from "./models/product.model.js";
import historyModel from "./models/history.model.js";
import settingModel from "./models/setting.model.js";
import { CronJob } from "cron";
import stockModel from "./models/stock.model.js";
import rangeModel from "./models/range.model.js";
import sizesModel from "./models/sizes.model.js";
import colourModel from "./models/colour.model.js";
import logModel from "./models/log.model.js";

import { ToadScheduler, SimpleIntervalJob, AsyncTask } from 'toad-scheduler';

import log4js from "log4js";

dotenv.config();

const scheduler = new ToadScheduler();

const syncTask = new AsyncTask("IQ Enterprise Sync Task", () => {
  return shopModel.findOne().then(shop => {
    return logModel.create({ shop: shop?.shop, status: "running", logs: []}).then(log => {
      syncData(shop?.shop, log._id);
    });
  })
}, (error) => { console.log("error", error) });

mongoose.connect(`${process.env.MONGODB_HOST}/${process.env.MONGODB_DB}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    if (process.env.NODE_ENV !== "test") {
      console.log("Connected to %s", `${process.env.MONGODB_HOST}/${process.env.MONGODB_DB}`);
    }
  });

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  async (req, res, next) => {
    const { shop, accessToken } = res.locals.shopify.session;
    await Shop.findOneAndUpdate(
      { shop: shop },
      {
        shop: shop,
        token: accessToken,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    next();
  },
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers })
);

import { fileURLToPath } from 'url';

import fs from "fs";

app.get("/view-log", (req, res) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const file = fs.readFileSync(path.join(path.join(__dirname, ""), "logs"), "utf-8");
  const logs = file.replace(/\r?\n/g, "<br/>");
  return res.status(200).send(logs);
  // return res.sendFile(path.join(path.join(__dirname, ""), "logs"), {headers: {'Content-Type': 'text/html'}});
});

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

app.get('/api/log', async (_req, res) => {
  try {
    const shop = _req.headers["shop"];
    const logs = await logModel.find({ shop }).sort({ _id: -1 }).limit(50);
    res.status(200).send({
      success:true,
      data: logs
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      success:false
    })
  }
})

app.get('/api/setting', async(_req,res) => {
  try {
    const shop = _req.headers["shop"];
    const defaultSetting = {
      interval: 1,
      company_codes: []
    }
    let setting = await settingModel.findOne({ shop }).lean();
    if (setting) {
      setting = Object.assign(defaultSetting, setting);
    } else {
      setting = defaultSetting
    }
    res.status(200).send({
      success:true,
      data: setting
    })
  } catch (error) {
    console.log(error)
    res.status(400).send({
      success:false
    })
  }
})

app.post('/api/setting', async(_req,res) => {
  try {
    const shop = _req.headers["shop"];

    const { interval, company_codes, location, api, username, password, terminal_number } = _req.body

    const data = await settingModel.findOneAndUpdate({ shop }, { interval,company_codes, location, api, username, password, terminal_number },{ upsert: true, new: true })

    scheduler.removeById(`${process.env.SYNC_TASK_ID}`);

    const job = new SimpleIntervalJob({ seconds: interval * 60, runImmediately: true }, syncTask, { id: `${process.env.SYNC_TASK_ID}`, preventOverrun: true });

    scheduler.addSimpleIntervalJob(job)

    res.status(200).send({
      success:true,
      data
    })
  } catch (error) {
    res.status(400).send({
      success:false
    })
  }
})

const getAPI = (setting) => {
  let { api, username, password } = setting;
  return axios.create({
    baseURL: `${api}`,
    auth: {
      username: `${username}`,
      password: `${password}`,
    },
    params: {
      callformat: "json"
    }
  })
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

log4js.configure({
  appenders: { mylogger: { type:"file", filename: "./logs" } },
  categories: { default: { appenders:["mylogger"], level:"ALL" } }
})

const logger = log4js.getLogger("default");

const getAllProducts = async (setting, company_code) => {
  try {
    let { username, password, terminal_number } = setting;
    let api = getAPI(setting);
    let hasNextPage = true;
    let recordOffset = 0;
    let stocks = []
    let companyInfo;
    while (hasNextPage) {
      let response = await api.post('/IQ_API_Request_Stock_Attributes', {
        "IQ_API": {
          "IQ_API_Request_Stock": {
            "IQ_Company_Number": company_code,
            "IQ_Terminal_Number": `${terminal_number}`,
            "IQ_User_Number": `${username}`,
            "IQ_User_Password": `${password}`,
            "IQ_Partner_Passphrase": "",
            "record_limit": 50,
            "record_offset": recordOffset
          }
        }
      })
      await sleep(1000);
      if (response?.data?.iq_api_error[0]?.iq_error_code === 5) {
        hasNextPage = false;
        break;
      }
      let { iq_page_data, iq_api_result_data } = response?.data;
      recordOffset = iq_page_data?.next_offset;
      stocks = stocks.concat(iq_api_result_data?.iq_root_json?.stock_master);
      logger.info("stocks", stocks?.length || 0)
      companyInfo = iq_api_result_data?.iq_root_json?.iq_identification_info
    }
    return { stocks, companyInfo }
  } catch (error) {
    console.log(error);
    return null;
  }
}

const getAllRanges = async (setting, company_code) => {
  try {
    let { username, password, terminal_number } = setting;
    let api = getAPI(setting);
    let hasNextPage = true;
    let recordOffset = 0;
    let ranges = []
    while (hasNextPage) {
      let response = await api.post('/IQ_API_Request_Stock_Range', {
        "IQ_API": {
          "IQ_API_Request_Stock_Ranges": {
            "IQ_Company_Number": company_code,
            "IQ_Terminal_Number": `${terminal_number}`,
            "IQ_User_Number": `${username}`,
            "IQ_User_Password": `${password}`,
            "IQ_Partner_Passphrase": "",
            "record_limit": 50,
            "record_offset": recordOffset
          }
        }
      })
      if (response?.data?.iq_api_error[0]?.iq_error_code === 5) {
        hasNextPage = false;
        break;
      }
      let { iq_page_data, iq_api_result_data } = response?.data;
      recordOffset = iq_page_data?.next_offset;
      ranges = ranges.concat(iq_api_result_data?.iq_root_json?.stock_ranges);
    }
    return ranges
  } catch (error) {
    return null;
  }
}

const getAllSizes = async (setting, company_code) => {
  try {
    let { username, password, terminal_number } = setting;
    let api = getAPI(setting);
    let hasNextPage = true;
    let recordOffset = 0;
    let sizes = []
    while (hasNextPage) {
      let response = await api.post('/IQ_API_Request_Stock_Sizes', {
        "IQ_API": {
          "IQ_API_Request_Stock_Sizes": {
            "IQ_Company_Number": company_code,
            "IQ_Terminal_Number": `${terminal_number}`,
            "IQ_User_Number": `${username}`,
            "IQ_User_Password": `${password}`,
            "IQ_Partner_Passphrase": "",
            "record_limit": 50,
            "record_offset": recordOffset
          }
        }
      })
      if (response?.data?.iq_api_error[0]?.iq_error_code === 5) {
        hasNextPage = false;
        break;
      }
      let { iq_page_data, iq_api_result_data } = response?.data;
      recordOffset = iq_page_data?.next_offset;
      sizes = sizes.concat(iq_api_result_data?.iq_root_json?.stock_sizes);
    }
    return sizes;
  } catch (error) {
    return null;
  }
}

const getAllColours = async (setting, company_code) => {
  try {
    let { username, password, terminal_number } = setting;
    let api = getAPI(setting);
    let hasNextPage = true;
    let recordOffset = 0;
    let colours = []
    let companyInfo;
    while (hasNextPage) {
      let response = await api.post('/IQ_API_Request_Stock_Colours', {
        "IQ_API": {
          "IQ_API_Request_Stock_Colours": {
            "IQ_Company_Number": company_code,
            "IQ_Terminal_Number": `${terminal_number}`,
            "IQ_User_Number": `${username}`,
            "IQ_User_Password": `${password}`,
            "IQ_Partner_Passphrase": "",
            "record_limit": 50,
            "record_offset": recordOffset
          }
        }
      })
      if (response?.data?.iq_api_error[0]?.iq_error_code === 5) {
        hasNextPage = false;
        break;
      }
      let { iq_page_data, iq_api_result_data } = response?.data;
      recordOffset = iq_page_data?.next_offset;
      colours = colours.concat(iq_api_result_data?.iq_root_json?.stock_colours);
    }
    return colours;
  } catch (error) {
    return null;
  }
}

const convertDescription = (text) => {
  let result = "";
  result = "<p>" + text + "</p>";
  result = result.replace(/\r\n\r\n/g, "</p><p>").replace(/\n\n/g, "</p><p>");
  result = result.replace(/\r\n/g, "<br />").replace(/\n/g, "<br />");
  return result;
}

const syncData = async (shop, logId) => {
  try {
    logger.info(`Run ${new Date()}`)

    const shopData = await shopModel.findOne({ shop });

    const shopify = axios.create({
      baseURL: `https://${shopData.shop}/admin/api/2023-10/graphql.json`,
      headers: {
        "X-Shopify-Access-Token": shopData.token,
        "Content-Type": "application/json"
      }
    })

    const setting = await settingModel.findOne({ shop });

    if (!setting) {
      return;
    }

    const { company_codes, location } = setting;

    const api = axios.create({
      baseURL: setting?.api,
      auth: {
        username: setting?.username,
        password: setting?.password,
      },
      params: {
        callformat: "json"
      }
    })

    const locationId = `gid://shopify/Location/${location}`;

    let logs = [];

    for (let company_code of company_codes) {
      // let companyInfo = {};

      // let stocks = await stockModel.find({ company_code });

      // stocks = stocks.map(s => s.data);

      // let ranges = await rangeModel.find({ company_code });

      // ranges = ranges.map(s => s.data);

      // let sizes = await sizesModel.find({ company_code });

      // sizes = sizes.map(s => s.data);

      // let colours = await colourModel.find({ company_code });

      // colours = colours.map(s => s.data);
      
      const { stocks, companyInfo } = await getAllProducts(setting, company_code);

      if (Array.isArray(stocks)) {
        await Promise.all(stocks.map(async (stock) => {
          await stockModel.findOneAndUpdate({ company_code, stock_code: stock.stock_code }, {
            company_code,
            stock_code: stock.stock_code,
            data: stock
          }, { upsert: true })
        }));
      }

      const ranges = await getAllRanges(setting, company_code);

      if (Array.isArray(ranges)) {
        await Promise.all(ranges.map(async (range) => {
          await rangeModel.findOneAndUpdate({ company_code, range: range.range }, {
            company_code,
            range: range.range,
            data: range
          }, { upsert: true })
        }));
      }

      const sizes = await getAllSizes(setting, company_code);

      if (Array.isArray(sizes)) {
        await Promise.all(sizes.map(async (size) => {
          await sizesModel.findOneAndUpdate({ company_code, number: size.number }, {
            company_code,
            number: size.number,
            data: size
          }, { upsert: true })
        }));
      }

      const colours = await getAllColours(setting, company_code);

      if (Array.isArray(colours)) {
        await Promise.all(colours.map(async (colour) => {
          await colourModel.findOneAndUpdate({ company_code, number: colour.number }, {
            company_code,
            number: colour.number,
            data: colour
          }, { upsert: true })
        }));
      }

      logger.info(`Stocks: ${stocks?.length}`);

      logger.info(`Ranges: ${ranges?.length}`);

      logger.info(`Sizes: ${sizes?.length}`);

      logger.info(`Colours: ${colours?.length}`);

      for (const stock of stocks) {
        if (!stock.web_item) {
          continue;
        }
        let sku = stock?.supplier_item_code;
        let stockRange = stock?.range;
        let colourNumber = stock?.colour_number;
        let sizeNumber = stock?.size_number;
        let findRange = ranges?.find((r) => r.range == stockRange);
        let range = findRange?.range_description;
        let findColour = colours?.find((c) => c.number == colourNumber);
        logger.info("findColour", findColour);
        let colour = findColour?.description;
        let findSize = sizes?.find((s) => s.number == sizeNumber);
        logger.info("findSize", findSize);
        let size = findSize?.description;
        let findProductResponse = await shopify.post("", JSON.stringify({
          query: `
            query {
              products(first: 1, query:"title:'${stock?.alternative_description}'") {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          `
        }));
        logger.info("findProductResponse", findProductResponse.data);
        let product = findProductResponse?.data?.data?.products?.edges[0];
        logger.info("product", product);
        let productID;
        if (product) {
          logger.info(`Product "${stock?.alternative_description}" existed`);
          logs.push(`Product "${stock?.alternative_description}" existed`);
          productID = product?.node?.id;
          if (productID) {
            let variables = {
              input: {
                id: productID,
                descriptionHtml: convertDescription(stock?.extended_description),
              }
            }
            logger.info("variables", JSON.stringify(variables))
            let updateProductResponse = await shopify.post("", JSON.stringify({
              query: `
                mutation productUpdate($input: ProductInput!) {
                  productUpdate(input: $input) {
                    product {
                      id
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }
              `,
              variables
            }));
            logger.info("updateProductResponse", updateProductResponse.data);
          }
        } else {
          logger.info(`Create product "${stock?.alternative_description}"`);
          logs.push(`Create product "${stock?.alternative_description}"`);
          let variables = {
            input: {
              title: `${stock?.alternative_description}`,
              descriptionHtml: convertDescription(stock?.extended_description),
              options: ["Size", "Colour"],
              variants: [
                {
                  inventoryItem: {
                    tracked: true
                  },
                  inventoryQuantities: {
                    availableQuantity: stock?.onhand,
                    locationId
                  },
                  price: stock?.sell_prices[0]?.inclusive,
                  // compareAtPrice: stock?.sell_prices[0]?.inclusive,
                  requiresShipping: true,
                  options: [size, colour],
                }
              ]
            }
          }
          if (range) {
            variables["input"]["tags"] = `RANGE:${range}`
          }
          logger.info("variables", JSON.stringify(variables))
          let createProductResponse = await shopify.post("", JSON.stringify({
            query: `
              mutation productCreate($input: ProductInput!) {
                productCreate(input: $input) {
                  product {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            variables
          }));
          logger.info("createProductResponse", createProductResponse.data);
          productID = createProductResponse?.data?.data?.productCreate?.product?.id
        }
        productID = productID.replace("gid://shopify/Product/", "");
        let findVariantRepsonse = await shopify.post("", JSON.stringify({
          query: `
            query {
              productVariants(first: 1, query:"product_id:'${productID}' AND option1:'${size}' AND option2:'${colour}'") {
                edges {
                  node {
                    id
                    inventoryItem {
                      id
                    }
                  }
                }
              }
            }
          `
        }))
        logger.info("findVariantRepsonse", findVariantRepsonse.data)
        let variant = findVariantRepsonse?.data?.data?.productVariants?.edges[0];
        let variantID;
        let inventoryItemId;
        if (variant) {
          logs.push(`Variant "${size} / ${colour}" existed`);
          inventoryItemId = variant?.node?.inventoryItem?.id;
          variantID = variant?.node?.id;
          logs.push(`Update variant "${size} / ${colour}"`);
          let variables = {
            input: {
              id: variantID,
              price: stock?.sell_prices[0]?.inclusive,
              sku,
              // compareAtPrice: stock?.sell_prices[0]?.inclusive,
            }
          }
          let updateVariantResponse = await shopify.post("", JSON.stringify({
            query: `
              mutation productVariantUpdate($input: ProductVariantInput!) {
                productVariantUpdate(input: $input) {
                  product {
                    id
                    title
                  }
                  productVariant {
                    createdAt
                    displayName
                    id
                  }
                }
              }
            `,
            variables
          }))
          let updateVariantQuantityResponse = await shopify.post("", JSON.stringify({
            query: `
              mutation ActivateInventoryItem($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
                inventoryActivate(inventoryItemId: $inventoryItemId, locationId: $locationId, available: $available) {
                  inventoryLevel {
                    id
                    available
                    item {
                      id
                    }
                    location {
                      id
                    }
                  }
                }
              }
            `,
            variables: {
              "inventoryItemId": inventoryItemId,
              "locationId": locationId,
              "available": stock?.onhand,
            }
          }));
        } else {
          logs.push(`Create variant "${size} / ${colour}"`);
          let variables = {
            input: {
              inventoryItem: {
                tracked: true
              },
              inventoryQuantities: {
                availableQuantity: stock?.onhand,
                locationId
              },
              price: stock?.sell_prices[0]?.inclusive,
              requiresShipping: true,
              options: [size, colour],
              sku,
              productId: `gid://shopify/Product/${productID}`
            }
          }
          let createVariantResponse = await shopify.post("", JSON.stringify({
            query: `
              mutation productVariantCreate($input: ProductVariantInput!) {
                productVariantCreate(input: $input) {
                  product {
                    id
                    title
                  }
                  productVariant {
                    createdAt
                    displayName
                    id
                  }
                }
              }
            `,
            variables
          }))
        }
      }

      logger.info("Done");

      await logModel.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(logId) }, { status: "done", logs });
    }
  } catch (error) {
    await logModel.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(logId) }, { status: "stopped", logs: [`${JSON.stringify(error)}`] });
    console.log(error);
  }
}

app.post('/api/sync_data', async (_req, res) => {
  try {
    const shop = _req.headers['shop']

    const log = await logModel.create({ shop, status: "running", logs: []});

    syncData(shop, log._id);

    res.status(200).send({ success: true })
  } catch (error) {
    console.log(error)
    res.status(400).send({ success: false })
  }
})

// API endpoints here

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);
