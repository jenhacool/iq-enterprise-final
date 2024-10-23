import mongoose from "mongoose";

const historySchema = mongoose.Schema(
    {
       productId:{
        type:'String'
       },
        shopifyProductId: {
            type: "String"
        },
       type:{
        type:"String"
       },
       status:{
        type:"String"
       },
       time:{
        type:"Date"
       }
    },
)

export default mongoose.model('History', historySchema)