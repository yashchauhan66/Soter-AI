(function () {
  const buttons = document.querySelectorAll("[data-soter-test]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const result = document.querySelector("[data-soter-test-result]");
      if (result) result.textContent = "Testing...";
      const body = new URLSearchParams();
      body.set("action", "soter_guard_test_connection");
      body.set("nonce", window.SoterAIGuardAdmin?.nonce || "");
      fetch(window.SoterAIGuardAdmin?.ajaxUrl || ajaxurl, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }).then(async (response) => {
        const data = await response.json();
        if (result) result.textContent = response.ok && data.success ? `Connected: ${data.data.action}` : data.data?.message || "Connection failed.";
      }).catch(() => {
        if (result) result.textContent = "Connection failed.";
      });
    });
  });
})();
