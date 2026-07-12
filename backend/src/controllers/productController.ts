import { Request, Response, NextFunction } from "express";
import Product from "../models/Product";
import "../models/Category";

// ===============================
// CREATE PRODUCT
// ===============================

export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  try {

    const product = await Product.create(req.body);


    res.status(201).json({

      success: true,

      message: "Product created successfully",

      data: product,

    });


  } catch (error) {

    next(error);

  }

};



// ===============================
// GET ALL PRODUCTS
// ===============================

export const getProducts = async (
  
  req: Request,
  res: Response,
  next: NextFunction
) => {

  try {


    const products = await Product.find()
      .populate("categoryId")
      .sort({
        createdAt: -1,
      });


console.log(Product.collection.name);
    res.status(200).json({

      success: true,

      message: "Products fetched successfully",

      data: products,

    });



  } catch(error){

    next(error);

  }

};



// ===============================
// GET SINGLE PRODUCT
// ===============================

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {

  try {


    const product = await Product.findById(
      req.params.id
    )
    .populate("categoryId");



    if(!product){

      return res.status(404).json({

        success:false,

        message:"Product not found",

      });

    }



    res.status(200).json({

      success:true,

      data:product,

    });



  }catch(error){

    next(error);

  }

};



// ===============================
// UPDATE PRODUCT
// ===============================

export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
)=>{


  try{


    const product = await Product.findByIdAndUpdate(

      req.params.id,

      req.body,

      {
        new:true,
        runValidators:true,
      }

    );



    if(!product){

      return res.status(404).json({

        success:false,

        message:"Product not found",

      });

    }



    res.status(200).json({

      success:true,

      message:"Product updated successfully",

      data:product,

    });



  }catch(error){

    next(error);

  }

};



// ===============================
// DELETE PRODUCT
// ===============================

export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
)=>{


  try{


    const product = await Product.findByIdAndDelete(
      req.params.id
    );



    if(!product){

      return res.status(404).json({

        success:false,

        message:"Product not found",

      });

    }



    res.status(200).json({

      success:true,

      message:"Product deleted successfully",

    });



  }catch(error){

    next(error);

  }

};