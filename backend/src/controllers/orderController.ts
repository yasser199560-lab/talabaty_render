import { Request, Response } from "express";
import Order, { OrderStatus } from "../models/Order";


const VALID_STATUSES: OrderStatus[] = [
  "pending",
  "preparing",
  "delivered",
  "cancelled",
];


// GET ALL ORDERS
// GET /api/orders
export const getOrders = async (
  req: Request,
  res: Response
) => {
  try {

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .lean();


    return res.status(200).json({
      data: orders,
    });


  } catch (error) {

    console.error("getOrders error:", error);

    return res.status(500).json({
      message: "Failed to fetch orders.",
    });

  }
};




// GET SINGLE ORDER
// GET /api/orders/:orderId
export const getOrderById = async (
  req: Request,
  res: Response
) => {

  try {

    const { orderId } = req.params;


    const order = await Order.findById(orderId);


    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }


    return res.status(200).json({
      data: order,
    });


  } catch (error) {

    console.error("getOrderById error:", error);

    return res.status(500).json({
      message: "Failed to fetch order.",
    });

  }

};





// UPDATE ORDER STATUS
// PATCH /api/orders/:orderId/status
export const updateOrderStatus = async (
  req: Request,
  res: Response
) => {

  try {

    const { orderId } = req.params;

    const { status } = req.body;



    if (!VALID_STATUSES.includes(status)) {

      return res.status(400).json({
        message: "Invalid order status",
      });

    }



    const order = await Order.findById(orderId);



    if (!order) {

      return res.status(404).json({
        message: "Order not found",
      });

    }



    order.orderStatus = status;

    await order.save();



    return res.status(200).json({

      message: "Order status updated successfully",

      data: order,

    });



  } catch (error) {

    console.error("updateOrderStatus error:", error);


    return res.status(500).json({

      message: "Failed to update order status",

    });

  }

};