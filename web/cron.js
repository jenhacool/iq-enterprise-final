import mongoose from "mongoose";
import productModel from "./models/product.model.js";
import historyModel from "./models/history.model.js";
import settingModel from "./models/setting.model.js";

const cronJobs = [];

const getSettings = async () => {
  try {

  } catch (error) {

  }
}

class Cron {
  async getSettings() {
    let settings = await settingModel.find();

    if (settings.length == 0) {
      return;
    }


  }

  async setCronJob(setting) {

  }

  async start() {

  }
}

export default Cron;