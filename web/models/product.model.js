import mongoose from "mongoose";

const productSchema = mongoose.Schema(
    {
        company: {
            type: "String",

        },
        companyId: {
            type: "String",
        },
        isUpdated: {
            type: "Boolean",
            default: false
        },
        productId: {
            type: "String"
        },
        shopifyProductId: {
            type: "String"
        },
        settings: {
            type: "Object"
        },

    },
)

export default mongoose.model('Product', productSchema)