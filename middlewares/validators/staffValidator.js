const { body } = require("express-validator");


exports.validateStaff = [
body("name").notEmpty().withMessage("Nome é obrigatório."),
body("role").notEmpty().withMessage("Cargo é obrigatório."),
];