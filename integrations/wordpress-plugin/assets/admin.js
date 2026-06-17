(function () {
  const buttons = document.querySelectorAll("[data-cyberrakshak-test]");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const result = document.querySelector("[data-cyberrakshak-test-result]");
      if (result) result.textContent = "Testing...";
      const body = new URLSearchParams();
      body.set("action", "cyberrakshak_guard_test_connection");
      body.set("nonce", window.CyberRakshakGuardAdmin?.nonce || "");
      fetch(window.CyberRakshakGuardAdmin?.ajaxUrl || ajaxurl, {
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
