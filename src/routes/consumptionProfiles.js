// src/routes/consumptionProfiles.js

const express = require("express");
const {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile
} = require("../controllers/consumptionProfileController.js");

const router = express.Router();

router.get("/consumption-profiles", listProfiles);
router.post("/consumption-profiles", createProfile);
router.put("/consumption-profiles/:id", updateProfile);
router.delete("/consumption-profiles/:id", deleteProfile);

module.exports = router;
