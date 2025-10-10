// middlewares/validators/guestValidator.js
const { body } = require("express-validator");

// POST /guests  -> name obrigatório; email/phone opcionais
const validateGuestCreate = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Nome é obrigatório."),

  body("email")
    .optional({ checkFalsy: true, nullable: true }) // aceita "", null, ausente
    .isEmail()
    .withMessage("Email inválido."),

  body("phone")
    .optional({ checkFalsy: true, nullable: true }) // aceita "", null, ausente
    .isString()
    .withMessage("Telefone inválido."),
];

// PUT /guests/:id -> todos opcionais; se vierem, valida
const validateGuestUpdate = [
  body("name")
    .optional({ checkFalsy: false })
    .trim()
    .notEmpty()
    .withMessage("Nome não pode ser vazio."),

  body("email")
    .optional({ checkFalsy: true, nullable: true })
    .isEmail()
    .withMessage("Email inválido."),

  body("phone")
    .optional({ checkFalsy: true, nullable: true })
    .isString()
    .withMessage("Telefone inválido."),
];

// Para não “bagunçar”: mantém o nome antigo para o CREATE
exports.validateGuest = validateGuestCreate;
exports.validateGuestCreate = validateGuestCreate;
exports.validateGuestUpdate = validateGuestUpdate;
