(() => {
  const MORE_LINKS = [
    { href: "/percentage-calculator", label: "Percentage Calculator" },
    { href: "/vat-calculator", label: "VAT Calculator" },
    { href: "/loan-payment-calculator", label: "Loan Payment Calculator" },
    { href: "/date-difference-calculator", label: "Date Difference" },
    { href: "/age-calculator", label: "Age Calculator" },
    { href: "/unit-converter", label: "Unit Converter" },
    { href: "/business-days", label: "Business Days" },
    { href: "/meeting-overlap", label: "Meeting Overlap" },
    { href: "/inflation-calculator", label: "Inflation Calculator" },
    { href: "/crypto-tax-estimator", label: "Crypto Tax Estimator" }
  ];

  function closeAllMore(nav) {
    nav.querySelectorAll(".nav-more.is-open").forEach((el) => {
      el.classList.remove("is-open");
      const btn = el.querySelector(".nav-more-toggle");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  document.querySelectorAll(".site-header").forEach((header) => {
    const nav = header.querySelector(".main-nav");
    const toggle = header.querySelector(".nav-toggle");
    if (!nav || !toggle) return;

    nav.querySelectorAll(".nav-more-menu").forEach((menu) => {
      menu.innerHTML = MORE_LINKS.map((link) => (
        `<a href="${link.href}">${link.label}</a>`
      )).join("");
    });

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      if (!isOpen) closeAllMore(nav);
    });

    nav.querySelectorAll(".nav-more").forEach((more) => {
      const btn = more.querySelector(".nav-more-toggle");
      if (!btn) return;

      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const isOpen = more.classList.contains("is-open");
        closeAllMore(nav);
        if (!isOpen) {
          more.classList.add("is-open");
          btn.setAttribute("aria-expanded", "true");
        } else {
          btn.setAttribute("aria-expanded", "false");
        }
      });
    });

    document.addEventListener("click", (event) => {
      if (!header.contains(event.target)) {
        closeAllMore(nav);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        closeAllMore(nav);
      }
    });
  });
})();
