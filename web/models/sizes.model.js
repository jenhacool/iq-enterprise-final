import mongoose from "mongoose";

const sizeSchema = mongoose.Schema(
  {
    company_code: {
      type: "String",
      required: true,
    },
    number: {
      type: "String",
      required: true,
    },
    data: {
      type: "Object",
    }
  },
  { timestamps: true }
);

export default mongoose.model("Size", sizeSchema);
