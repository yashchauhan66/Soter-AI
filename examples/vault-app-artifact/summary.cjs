"use strict";
const settings = require("./settings.json");
exports.publicMessage = () => settings.message + "\n";
