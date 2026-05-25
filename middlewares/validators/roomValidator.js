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

  body("preparedBeds")
    .optional({ values: "falsy" })
    .isInt({ min: 0 })
    .withMessage("Camas preparadas deve ser um numero inteiro maior ou igual a zero."),

  body("laundryTemplate")
    .optional({ values: "falsy" })
    .custom((value) => typeof value === "object" || typeof value === "string")
    .withMessage("Modelo de lavanderia invalido."),
];
