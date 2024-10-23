import mongoose from "mongoose";

const rangeSchema = mongoose.Schema(
  {
    company_code: {
      type: "String",
      required: true,
    },
    range: {
      type: "String",
      required: true,
    },
    data: {
      type: "Object",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Range", rangeSchema);
