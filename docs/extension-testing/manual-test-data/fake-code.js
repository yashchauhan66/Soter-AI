const token = "ghp_fakeFakeFakeFakeFakeFakeFakeFake1234";
function authenticateUser(token) {
  return token === process.env.JWT_SECRET;
}
