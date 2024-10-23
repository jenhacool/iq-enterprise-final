import mongoose from "mongoose";

const webhookSchema = mongoose.Schema(
  {
    shop: {
      type: "String",
      required: true,
    },
    topic: {
      type: "String",
      required: true
    },
    webhookId: {
      type: "String",
      required: true
    },
    payload: {
      type: "Object",
      required: true
    },
    status: {
      type: "String",
      required: true,
      default: "NOT_PROCESS"
    }
  },
  { timestamps: true }
);

export default mongoose.model("Webhook", webhookSchema);
