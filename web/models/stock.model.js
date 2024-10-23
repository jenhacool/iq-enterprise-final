import mongoose from "mongoose";

const stockSchema = mongoose.Schema(
  {
    company_code: {
      type: "String",
      required: true,
    },
    stock_code: {
      type: "String",
      required: true,
    },
    data: {
      type: "Object",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Stock", stockSchema);
