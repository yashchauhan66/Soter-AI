(function () {
  const buttons = document.querySelectorAll("[data-cyberrakshak-test]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      button.textContent = "Test from WordPress admin only";
    });
  });
})();

