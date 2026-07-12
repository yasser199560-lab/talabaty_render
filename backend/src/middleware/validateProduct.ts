import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";

export const validateProduct = [
  body("partnerId")
    .notEmpty()
    .withMessage("Partner ID is required")
    .isMongoId()
    .withMessage("Invalid Partner ID"),

  //body("categoryId")
   // .notEmpty()
    //.withMessage("Category is required")
   // .isMongoId()
   // .withMessage("Invalid Category ID"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 2, max: 150 })
    .withMessage("Title must be between 2 and 150 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("price")
    .notEmpty()
    .withMessage("Price is required")
    .isFloat({ min: 0 })
    .withMessage("Price must be greater than or equal to 0"),

  body("imageUrl")
    .notEmpty()
    .withMessage("Image URL is required")
    .isURL()
    .withMessage("Invalid Image URL"),

  body("paymentStatus")
    .optional()
    .isIn(["Pending", "Paid", "Unpaid"])
    .withMessage("Invalid payment status"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be true or false"),

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation Failed",
        errors: errors.array(),
      });
    }

    next();
  },
];