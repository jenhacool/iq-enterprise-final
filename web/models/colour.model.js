import mongoose from "mongoose";

const colourSchema = mongoose.Schema(
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

export default mongoose.model("Colour", colourSchema);
