import dotenv from "dotenv";

// Load .env FIRST
dotenv.config();


import http from "http";
import mongoose from "mongoose";

import app from "./app";
import connectDB from "./config/db";


const PORT = Number(process.env.PORT) || 5000;


const startServer = async () => {

    try {

        await connectDB();


        const server = http.createServer(app);


        server.listen(PORT, () => {

            console.log(
                `🚀 Server running on port ${PORT}`
            );

        });


        server.on("error", (error: any) => {

            if (error.code === "EADDRINUSE") {

                console.error(
                    `❌ Port ${PORT} is already in use`
                );

                process.exit(1);

            }


            console.error(
                "❌ Server error:",
                error
            );

        });



        const shutdown = async () => {

            console.log(
                "🛑 Shutting down server..."
            );


            try {

                await mongoose.connection.close();


                server.close(() => {

                    console.log(
                        "✅ Server closed"
                    );


                    process.exit(0);

                });


            } catch(error) {


                console.error(
                    "❌ Shutdown error",
                    error
                );


                process.exit(1);

            }

        };



        process.on(
            "SIGINT",
            shutdown
        );


        process.on(
            "SIGTERM",
            shutdown
        );



    } catch(error) {


        console.error(
            "❌ Server startup failed",
            error
        );


        process.exit(1);

    }

};



startServer();