import mongoose from "mongoose";

const shopSchema = mongoose.Schema(
  {
    shop: {
      type: "String",
      required: true,
    },
    token: {
      type: "String",
    },
    settings: {
      type: "Object"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Shop", shopSchema);
