import mongoose from "mongoose";

const settingSchema = mongoose.Schema(
  {
    shop: {
      type: "String",
      require: true
    },
    interval:{
      type: "Number",
      default: 0
    },
    company_codes:{
      type: "Object",
      default: []
    },
    location: {
      type: "Number",
      default: 0
    },
    api: {
      type: "String"
    },
    username: {
      type: "String"
    },
    password: {
      type: "String"
    },
    terminal_number: {
      type: "String"
    }
  }
)

export default mongoose.model('Setting', settingSchema)