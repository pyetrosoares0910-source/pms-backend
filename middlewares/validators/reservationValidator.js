const { body } = require("express-validator");

// Validação para criar reserva
const validateReservationCreate = [
  body("guestId")
    .notEmpty().withMessage("ID do hóspede é obrigatório.")
    .bail()
    .isUUID(4).withMessage("ID do hóspede deve ser um UUID válido."),
  body("roomId")
    .notEmpty().withMessage("ID do quarto é obrigatório.")
    .bail()
    .isUUID(4).withMessage("ID do quarto deve ser um UUID válido."),
  body("checkinDate")
    .isISO8601()
    .withMessage("Data de check-in inválida."),
  body("checkoutDate")
    .isISO8601()
    .withMessage("Data de check-out inválida."),
  body("status")
    .isIn(["agendada", "ativa", "concluida", "cancelada"])
    .withMessage("Status inválido."),
  body("notes").optional().isString(),
];

// Validação para atualizar reserva (todos opcionais)
const validateReservationUpdate = [
  body("guestId")
    .optional()
    .isUUID(4)
    .withMessage("ID do hóspede inválido."),
  body("roomId")
    .optional()
    .isUUID(4)
    .withMessage("ID do quarto inválido."),
  body("checkinDate")
    .optional()
    .isISO8601()
    .withMessage("Data de check-in inválida."),
  body("checkoutDate")
    .optional()
    .isISO8601()
    .withMessage("Data de check-out inválida."),
  body("status")
    .optional()
    .isIn(["agendada", "ativa", "concluida", "cancelada"])
    .withMessage("Status inválido."),
  body("notes").optional().isString(),
];

module.exports = {
  validateReservationCreate,
  validateReservationUpdate,
};
