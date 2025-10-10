const { body } = require("express-validator");


exports.validateRoom = [
body("name")
  .optional()
  .notEmpty().withMessage("Nome não pode ser vazio."),

body("capacity")
  .optional()
  .isInt({ min: 1 }).withMessage("Capacidade deve ser um número positivo."),

body("status")
  .optional()
  .isIn(["disponivel", "indisponivel"]).withMessage("Status inválido."),

body("type")
  .optional()
  .notEmpty().withMessage("Tipo do quarto não pode ser vazio."),
]