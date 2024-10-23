import mongoose from "mongoose";

const logSchema = mongoose.Schema(
  {
    shop: {
      type: "String",
    },
    status: {
      type: "String",
    },
    logs: {
      type: "Object"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Log", logSchema);
