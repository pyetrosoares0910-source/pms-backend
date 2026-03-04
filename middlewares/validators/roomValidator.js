const { body } = require("express-validator");

exports.validateRoom = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Titulo do quarto e obrigatorio."),

  body("category")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Categoria invalida."),

  body("description")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Descricao invalida."),

  body("active")
    .optional()
    .isBoolean()
    .withMessage("Campo active deve ser booleano."),

  body("stayId")
    .optional({ values: "falsy" })
    .isUUID()
    .withMessage("Empreendimento invalido."),

  body("position")
    .optional({ values: "falsy" })
    .isInt()
    .withMessage("Posicao deve ser um numero inteiro."),
];
