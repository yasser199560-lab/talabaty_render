import dns from "dns";
import mongoose from "mongoose";

// Fix MongoDB Atlas SRV DNS issue
dns.setServers([
    "8.8.8.8",
    "1.1.1.1"
]);

dns.setDefaultResultOrder("ipv4first");


const connectDB = async (): Promise<void> => {

    const MONGO_URI = process.env.MONGO_URI;


    if (!MONGO_URI) {
        console.error("❌ MONGO_URI is missing in .env file");
        process.exit(1);
    }


    try {

        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            family: 4
        });


        console.log("✅ MongoDB connected successfully");


    } catch (error) {

        console.error("❌ MongoDB connection failed");


        if (error instanceof Error) {
            console.error(error.message);
        }


        process.exit(1);
    }

};


export default connectDB;


//const uri = mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB};

//await mongoose.connect(uri);

