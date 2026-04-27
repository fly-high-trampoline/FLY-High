import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";
import QRCode from "qrcode";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

// MODEL
const bookingSchema = new mongoose.Schema({
  name:String,
  phone:String,
  hours:Number,
  amount:Number,
  day:String,
  status:String,
  bookingId:String,
  paymentId:String,
  createdAt:{type:Date, default:Date.now}
});

const Booking = mongoose.model("Booking", bookingSchema);

// RAZORPAY
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// CREATE ORDER
app.post("/create-order", async (req,res)=>{
  try{
    const {amount} = req.body;

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR"
    });

    res.json(order);
  }catch(err){
    res.status(500).json({error:"Order failed"});
  }
});

// VERIFY PAYMENT (IMPORTANT)
app.post("/verify-payment", async (req,res)=>{
  const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex");

  if(expectedSignature === razorpay_signature){
    res.json({success:true});
  }else{
    res.status(400).json({success:false});
  }
});

// SAVE BOOKING
app.post("/book", async (req,res)=>{
  try{
    const bookingId = "FH" + Date.now();

    const booking = new Booking({
      ...req.body,
      bookingId,
      status:"paid"
    });

    await booking.save();

    const qr = await QRCode.toDataURL(bookingId);

    res.json({booking, qr});
  }catch{
    res.status(500).json({error:"Booking failed"});
  }
});

// SLOT CONTROL
const MAX_CAPACITY = 50;

app.post("/check-slot", async (req,res)=>{
  const {date,time} = req.body;

  const count = await Booking.countDocuments({date,time});

  if(count >= MAX_CAPACITY){
    return res.json({available:false});
  }

  res.json({available:true});
});

// ADMIN
app.get("/admin/bookings", async (req,res)=>{
  const data = await Booking.find().sort({createdAt:-1});
  res.json(data);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
