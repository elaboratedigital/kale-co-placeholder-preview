"use strict";

const CART_KEY = "kaleCoCart.v1";
const AUTH_KEY = "kalePreviewAuth.v1";
const ORDER_KEY = "kaleCoLastOrder.v1";
const PREVIEW_GATE_ENABLED = true;
const PREVIEW_PASS_SHA256 = "7cf0e884f39651827a9880f981daa0c3b32241dc949e67d2dc71614a98e90a27";

let CONTENT = null;

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function money(cents) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function toCents(value) { return Math.round(Number(value) * 100); }

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function currentPage() {
  return document.body.getAttribute("data-page") || "home";
}

function pageFile(name) {
  return name === "home" ? "index.html" : name + ".html";
}

async function loadContent() {
  const res = await fetch("content.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load content.json");
  return res.json();
}

function allItems(content) {
  const items = [];
  (content.menu.categories || []).forEach((cat) => {
    (cat.items || []).forEach((item) => items.push({ ...item, categoryId: cat.id, categoryName: cat.name }));
  });
  return items;
}

function findItem(content, id) {
  return allItems(content).find((item) => item.id === id);
}

function getCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((row) => row && row.id && Number(row.qty) > 0) : [];
  } catch (err) {
    return [];
  }
}

function setCart(rows) {
  localStorage.setItem(CART_KEY, JSON.stringify(rows));
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce((sum, row) => sum + Number(row.qty || 0), 0);
}

function addToCart(id, qty) {
  const next = getCart();
  const found = next.find((row) => row.id === id);
  const add = Math.max(1, Number(qty || 1));
  if (found) found.qty = Math.min(99, Number(found.qty) + add);
  else next.push({ id, qty: Math.min(99, add) });
  setCart(next);
}

function setQty(id, qty) {
  const n = Math.max(0, Math.min(99, Number(qty)));
  if (n === 0) setCart(getCart().filter((row) => row.id !== id));
  else setCart(getCart().map((row) => row.id === id ? { ...row, qty: n } : row));
}

function removeFromCart(id) {
  setCart(getCart().filter((row) => row.id !== id));
}

function cartLines(content) {
  const lines = [];
  getCart().forEach((row) => {
    const item = findItem(content, row.id);
    if (!item || item.soldOut) return;
    const qty = Number(row.qty);
    const unit = toCents(item.price);
    lines.push({
      id: item.id,
      name: item.name,
      qty,
      unitCents: unit,
      lineCents: unit * qty,
      image: item.image,
      price: item.price
    });
  });
  return lines;
}

function totals(content, fulfillment) {
  const lines = cartLines(content);
  const subtotal = lines.reduce((sum, line) => sum + line.lineCents, 0);
  const deliveryFee = fulfillment === "delivery" ? toCents(content.delivery.flatFee || 0) : 0;
  const taxRate = Number(content.tax.rate || 0);
  const tax = Math.round((subtotal + deliveryFee) * taxRate);
  return {
    lines,
    subtotalCents: subtotal,
    deliveryFeeCents: deliveryFee,
    taxCents: tax,
    totalCents: subtotal + deliveryFee + tax,
    fulfillment: fulfillment || "pickup"
  };
}

/* Exported for automated tests */
window.KaleCart = {
  getCart, setCart, addToCart, setQty, removeFromCart, cartLines, totals, toCents, money, CART_KEY
};

function updateCartBadge() {
  $$("[data-cart-count]").forEach((el) => { el.textContent = String(cartCount()); });
}

function renderChrome(content) {
  const page = currentPage();
  const banner = content.meta && content.meta.banner ? content.meta.banner : "PREVIEW – placeholder content";
  const bannerEl = $("#placeholder-banner");
  if (bannerEl) {
    bannerEl.className = "banner";
    bannerEl.innerHTML = escapeHtml(banner);
  }

  const links = [
    ["home", "Home"],
    ["menu", "Menu"],
    ["about", "About"],
    ["visit", "Hours & Location"],
    ["contact", "Contact"]
  ];
  const nav = links.map(([id, label]) =>
    `<a href="${pageFile(id)}"${page === id ? ' aria-current="page"' : ""}>${label}</a>`
  ).join("");

  const header = $("#site-header");
  if (header) {
    header.className = "site-header";
    header.innerHTML = `
      <div class="wrap header-inner">
        <a class="brand" href="index.html" aria-label="${escapeHtml(content.business.name)} home">
          <img src="assets/logos/logo-header.svg" alt="${escapeHtml(content.business.name)}">
        </a>
        <nav class="desktop" aria-label="Main">${nav}</nav>
        <div class="header-actions">
          <a class="cart-link" href="cart.html">Cart <span class="cart-count" data-cart-count>0</span></a>
          <a class="btn small" href="menu.html">Order</a>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">Menu</button>
        </div>
      </div>
      <nav id="mobile-nav" class="mobile-nav" aria-label="Mobile">${nav}</nav>
    `;
    const toggle = header.querySelector(".menu-toggle");
    const mobile = $("#mobile-nav");
    toggle.addEventListener("click", () => {
      const open = mobile.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const footer = $("#site-footer");
  if (footer) {
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="wrap footer-inner">
        <div>
          <p><strong>${escapeHtml(content.business.name)}</strong> · ${escapeHtml(content.business.city)}</p>
          <p>${escapeHtml(content.contact.addressLine1)}<br>${escapeHtml(content.contact.addressLine2)}</p>
          <p>${escapeHtml(content.contact.phone)}<br>${escapeHtml(content.contact.email)}</p>
          <p class="fine">${escapeHtml(content.policies.note)}</p>
        </div>
        <div class="footer-nav">
          <a href="menu.html">Menu</a>
          <a href="about.html">About</a>
          <a href="visit.html">Hours &amp; Location</a>
          <a href="contact.html">Contact</a>
          <a href="cart.html">Cart</a>
        </div>
      </div>
    `;
  }
  updateCartBadge();
}

function itemCard(item, options) {
  const sold = item.soldOut;
  const tag = sold ? '<span class="tag sold-tag">Placeholder · Sold out</span>' : '<span class="tag">Placeholder item</span>';
  const button = sold
    ? '<button class="btn small" type="button" disabled>Sold out</button>'
    : `<button class="btn small" type="button" data-add="${escapeHtml(item.id)}">Add</button>`;
  return `
    <article class="card">
      <img src="${escapeHtml(item.image)}" alt="Placeholder illustration, not a photograph of ${escapeHtml(item.name)}">
      <div class="card-body">
        ${tag}
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="card-bottom">
          <span class="price">${money(toCents(item.price))}</span>
          ${button}
        </div>
      </div>
    </article>
  `;
}

function bindAddButtons(root) {
  (root || document).addEventListener("click", (event) => {
    const btn = event.target.closest("[data-add]");
    if (!btn || btn.disabled) return;
    const id = btn.getAttribute("data-add");
    const item = findItem(CONTENT, id);
    if (!item || item.soldOut) return;
    addToCart(id, 1);
    const previous = btn.textContent;
    btn.textContent = "Added";
    setTimeout(() => { btn.textContent = previous; }, 900);
  });
}

function renderHome(content) {
  const featured = content.menu.categories.slice(0, 3).map((cat) => cat.items.find((item) => !item.soldOut) || cat.items[0]).filter(Boolean);
  const main = $("#main");
  main.innerHTML = `
    <section class="hero wrap">
      <div>
        <p class="eyebrow">${escapeHtml(content.business.name)} · ${escapeHtml(content.business.city)}</p>
        <h1>${escapeHtml(content.business.heroHeadline)}</h1>
        <p class="lede">${escapeHtml(content.business.heroSubhead)}</p>
        <div class="hero-actions">
          <a class="btn" href="menu.html">See the menu</a>
          <a class="btn secondary" href="visit.html">Hours &amp; location</a>
        </div>
        <p class="fine">${escapeHtml(content.business.heroNote)}</p>
      </div>
      <figure class="hero-figure">
        <img src="assets/images/hero-bowl.svg" alt="Original placeholder illustration of a bowl of greens, not a photograph of a real dish">
        <figcaption>Original placeholder illustration · Not an actual dish</figcaption>
        <span class="badge-round">GOOD FOOD.<br>GOOD MOOD.</span>
      </figure>
    </section>
    <div class="ribbon">
      <span>Browse the menu</span>
      <span>Pickup or one delivery area</span>
      <span>Card or pay at pickup</span>
    </div>
    <section class="section wrap">
      <div class="section-head">
        <p class="eyebrow">How ordering works</p>
        <h2>Simple from the start.</h2>
      </div>
      <div class="feature-grid">
        <div class="feature"><h3>1. Choose your food</h3><p>Browse placeholder categories and items. Real dishes and prices will replace these.</p></div>
        <div class="feature"><h3>2. Pickup or delivery</h3><p>Checkout asks for pickup or one standard delivery area with a flat delivery fee.</p></div>
        <div class="feature"><h3>3. Pay your way</h3><p>Pay by card through the client's Stripe account, or choose pay at pickup. Stripe is a placeholder on this preview.</p></div>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head">
        <p class="eyebrow">A taste of the menu</p>
        <h2>Sample dishes</h2>
        <p>${escapeHtml(content.menu.intro)}</p>
      </div>
      <div class="cards">${featured.map((item) => itemCard(item)).join("")}</div>
      <p style="margin-top:24px"><a class="btn secondary" href="menu.html">View full sample menu</a></p>
    </section>
  `;
  bindAddButtons(main);
}

function renderMenu(content) {
  const main = $("#main");
  const cats = content.menu.categories;
  main.innerHTML = `
    <section class="section wrap">
      <div class="section-head">
        <p class="eyebrow">Order ahead</p>
        <h2>Sample menu</h2>
        <p>${escapeHtml(content.menu.intro)}</p>
        <p class="fine">${escapeHtml(content.policies.allergens)}</p>
      </div>
      <div class="filters" role="tablist" aria-label="Menu categories">
        <button class="filter-btn active" type="button" data-filter="all" aria-pressed="true">All</button>
        ${cats.map((cat) => `<button class="filter-btn" type="button" data-filter="${escapeHtml(cat.id)}" aria-pressed="false">${escapeHtml(cat.name)}</button>`).join("")}
      </div>
      <div id="menu-sections"></div>
    </section>
  `;
  const mount = $("#menu-sections");
  function draw(filter) {
    const shown = filter === "all" ? cats : cats.filter((cat) => cat.id === filter);
    mount.innerHTML = shown.map((cat) => `
      <section class="menu-category" style="margin-bottom:36px" data-category="${escapeHtml(cat.id)}">
        <h3>${escapeHtml(cat.name)}</h3>
        <div class="menu-grid">${cat.items.map((item) => itemCard(item)).join("")}</div>
      </section>
    `).join("");
  }
  draw("all");
  main.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-filter]");
    if (!btn) return;
    $$(".filter-btn", main).forEach((el) => {
      el.classList.toggle("active", el === btn);
      el.setAttribute("aria-pressed", el === btn ? "true" : "false");
    });
    draw(btn.getAttribute("data-filter"));
  });
  bindAddButtons(main);
}

function renderAbout(content) {
  $("#main").innerHTML = `
    <section class="section wrap about-grid">
      <div>
        <img class="about-badge" src="assets/logos/logo-badge.svg" alt="Concept logo for The Kale Company, pending client approval">
        <p class="fine" style="text-align:center">Concept logo · pending client approval</p>
      </div>
      <div>
        <p class="eyebrow">Our story</p>
        <h1>${escapeHtml(content.about.headline)}</h1>
        ${content.about.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        <p class="fine">Placeholder copy. Replace the paragraphs in content.json when the client sends their story.</p>
      </div>
    </section>
  `;
}

function renderVisit(content) {
  const hours = content.hours.entries.map((row) =>
    `<tr><th>${escapeHtml(row.days)}</th><td>${escapeHtml(row.hours)}</td></tr>`
  ).join("");
  const zips = (content.delivery.zips || []).join(", ");
  $("#main").innerHTML = `
    <section class="section wrap">
      <p class="eyebrow">Visit us</p>
      <h1>Hours &amp; location</h1>
      <p class="fine">${escapeHtml(content.hours.note)}</p>
      <div class="info-grid" style="margin-top:28px">
        <div class="info-card">
          <h3>Pickup address</h3>
          <p>${escapeHtml(content.contact.addressLine1)}<br>${escapeHtml(content.contact.addressLine2)}</p>
          <p class="fine">${escapeHtml(content.contact.mapNote)}</p>
        </div>
        <div class="info-card">
          <h3>Opening hours</h3>
          <table class="hours-table">${hours}</table>
          <p class="fine">${escapeHtml(content.hours.timezoneLabel)}</p>
        </div>
        <div class="info-card">
          <h3>Delivery</h3>
          <p><strong>${escapeHtml(content.delivery.areaName)}</strong></p>
          <p>${escapeHtml(content.delivery.areaDescription)}</p>
          <p>Demo ZIP codes: ${escapeHtml(zips)}</p>
          <p>${escapeHtml(content.delivery.feeLabel)}: <strong>${money(toCents(content.delivery.flatFee))}</strong></p>
        </div>
      </div>
      <div class="map-placeholder" style="margin-top:24px">
        <p><strong>Map placeholder</strong><br>A map will be added after the real pickup address is confirmed. Do not travel based on this preview.</p>
      </div>
    </section>
  `;
}

function renderContact(content) {
  $("#main").innerHTML = `
    <section class="section wrap checkout-grid">
      <div>
        <p class="eyebrow">Get in touch</p>
        <h1>Contact</h1>
        <p>${escapeHtml(content.contactPage.intro)}</p>
        <div class="info-card">
          <p><strong>Phone</strong><br>${escapeHtml(content.contact.phone)}</p>
          <p><strong>Email</strong><br>${escapeHtml(content.contact.email)}</p>
          <p><strong>Address</strong><br>${escapeHtml(content.contact.addressLine1)}<br>${escapeHtml(content.contact.addressLine2)}</p>
        </div>
      </div>
      <form id="contact-form" class="panel" novalidate>
        <h2>Send a note</h2>
        <p class="fine">${escapeHtml(content.contactPage.formNote)}</p>
        <label>Your name<input name="name" type="text" required maxlength="100" autocomplete="name"></label>
        <label>Email<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
        <label>Message<textarea name="message" required maxlength="2000"></textarea></label>
        <p style="margin-top:18px"><button class="btn wide" type="submit">Submit placeholder form</button></p>
        <p id="contact-result" class="fine" hidden></p>
      </form>
    </section>
  `;
  $("#contact-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const out = $("#contact-result");
    out.hidden = false;
    out.textContent = "This is a placeholder form. Your message was not sent and is not stored on a server.";
  });
}

function renderCartRows(content) {
  const { lines, subtotalCents } = totals(content, "pickup");
  const mount = $("#cart-rows");
  if (!lines.length) {
    mount.innerHTML = `<div class="empty"><p>Your cart is empty.</p><p><a class="btn" href="menu.html">Browse the sample menu</a></p></div>`;
    $("#cart-summary").hidden = true;
    return;
  }
  $("#cart-summary").hidden = false;
  mount.innerHTML = `<div class="cart-list">${lines.map((line) => `
    <div class="cart-row" data-id="${escapeHtml(line.id)}">
      <img src="${escapeHtml(line.image)}" alt="">
      <div>
        <strong>${escapeHtml(line.name)}</strong>
        <div class="fine">${money(line.unitCents)} each</div>
        <div class="qty">
          <button type="button" data-qty="${escapeHtml(line.id)},-1" aria-label="Remove one ${escapeHtml(line.name)}">−</button>
          <span>${line.qty}</span>
          <button type="button" data-qty="${escapeHtml(line.id)},1" aria-label="Add one ${escapeHtml(line.name)}">+</button>
        </div>
        <button type="button" class="linkish" data-remove="${escapeHtml(line.id)}">Remove</button>
      </div>
      <strong>${money(line.lineCents)}</strong>
    </div>
  `).join("")}</div>`;
  $("#cart-subtotal").textContent = money(subtotalCents);
}

function renderCart(content) {
  $("#main").innerHTML = `
    <section class="section wrap">
      <p class="eyebrow">Your order</p>
      <h1>Cart</h1>
      <div class="cart-layout">
        <div id="cart-rows"></div>
        <aside id="cart-summary" class="panel">
          <h2>Summary</h2>
          <div class="totals">
            <div><span>Subtotal</span><strong id="cart-subtotal">$0.00</strong></div>
          </div>
          <p class="fine">Delivery fee, if you choose delivery, is added at checkout. ${escapeHtml(content.tax.note)}</p>
          <p><a class="btn wide" href="checkout.html">Continue to checkout</a></p>
          <p><a class="btn secondary wide" href="menu.html">Keep browsing</a></p>
        </aside>
      </div>
    </section>
  `;
  renderCartRows(content);
  $("#main").addEventListener("click", (event) => {
    const qtyBtn = event.target.closest("[data-qty]");
    const removeBtn = event.target.closest("[data-remove]");
    if (qtyBtn) {
      const [id, delta] = qtyBtn.getAttribute("data-qty").split(",");
      const row = getCart().find((item) => item.id === id);
      setQty(id, (row ? row.qty : 0) + Number(delta));
      renderCartRows(content);
    }
    if (removeBtn) {
      removeFromCart(removeBtn.getAttribute("data-remove"));
      renderCartRows(content);
    }
  });
}

function zipAllowed(content, zip) {
  const clean = String(zip || "").replace(/\D/g, "").slice(0, 5);
  return (content.delivery.zips || []).includes(clean);
}

function renderCheckoutSummary(content, fulfillment) {
  const t = totals(content, fulfillment);
  $("#summary-lines").innerHTML = t.lines.map((line) =>
    `<div><span>${line.qty} × ${escapeHtml(line.name)}</span><span>${money(line.lineCents)}</span></div>`
  ).join("") || "<p class='fine'>Your cart is empty.</p>";
  $("#sum-subtotal").textContent = money(t.subtotalCents);
  $("#sum-delivery-row").hidden = fulfillment !== "delivery";
  $("#sum-delivery").textContent = money(t.deliveryFeeCents);
  $("#sum-tax-row").hidden = t.taxCents === 0;
  $("#sum-tax").textContent = money(t.taxCents);
  $("#sum-total").textContent = money(t.totalCents);
}

function renderCheckout(content) {
  if (!cartLines(content).length) {
    $("#main").innerHTML = `<section class="section wrap"><div class="empty"><h1>Checkout</h1><p>Add a sample item before checking out.</p><p><a class="btn" href="menu.html">Browse the sample menu</a></p></div></section>`;
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const cancelled = params.get("payment") === "cancelled";
  $("#main").innerHTML = `
    <section class="section wrap">
      <p class="eyebrow">Almost there</p>
      <h1>Checkout</h1>
      <p class="callout">This is a placeholder checkout. No payment is processed and no order is sent to the restaurant.</p>
      ${cancelled ? '<p class="error">Stripe Checkout was cancelled in this demo. You can try again or choose pay at pickup.</p>' : ""}
      <div class="checkout-grid">
        <form id="checkout-form" class="panel" novalidate>
          <h2>Your details</h2>
          <div class="field-row">
            <label>Name<input name="name" type="text" required maxlength="100" autocomplete="name"></label>
            <label>Phone<input name="phone" type="tel" required maxlength="40" autocomplete="tel"></label>
          </div>
          <label>Email<input name="email" type="email" required maxlength="120" autocomplete="email"></label>
          <h2 style="margin-top:28px">How would you like to get this order?</h2>
          <div class="radio-row">
            <label class="choice"><input type="radio" name="fulfillment" value="pickup" checked><span>Pickup<small>Collect it at the restaurant. Pay by card or pay at pickup.</small></span></label>
            <label class="choice"><input type="radio" name="fulfillment" value="delivery"><span>Delivery<small>${escapeHtml(content.delivery.areaName)}. ${escapeHtml(content.delivery.feeLabel)}: ${money(toCents(content.delivery.flatFee))}.</small></span></label>
          </div>
          <div id="delivery-fields" hidden>
            <label>Street address<input name="street" type="text" maxlength="120" autocomplete="address-line1"></label>
            <label>Apartment or suite (optional)<input name="apt" type="text" maxlength="40" autocomplete="address-line2"></label>
            <div class="field-row">
              <label>City<input name="city" type="text" maxlength="80" autocomplete="address-level2" value="Baltimore"></label>
              <label>State<input name="state" type="text" maxlength="20" autocomplete="address-level1" value="MD"></label>
            </div>
            <label>ZIP code<input name="zip" type="text" inputmode="numeric" maxlength="10" autocomplete="postal-code" placeholder="e.g. 21218"></label>
            <p id="zip-error" class="error" hidden></p>
            <p class="fine">Demo ZIPs: ${(content.delivery.zips || []).map(escapeHtml).join(", ")}. ${escapeHtml(content.delivery.areaDescription)}</p>
          </div>
          <label>Order notes (optional)<textarea name="notes" maxlength="1000" placeholder="Allergen requests must be confirmed with the restaurant."></textarea></label>
          <h2 style="margin-top:28px">Payment</h2>
          <div class="pay-options">
            <label class="choice"><input type="radio" name="payment" value="card" checked><span>Pay with card (Stripe)<small>Uses the client's Stripe account. This preview is not connected, so no card is charged.</small></span></label>
            <label class="choice" id="pay-pickup-choice"><input type="radio" name="payment" value="pickup"><span>Pay at pickup<small>Available for pickup orders only. Staff collect payment when you arrive.</small></span></label>
          </div>
          <div class="stripe-box">
            <strong>Stripe Checkout integration point</strong>
            <p>Status: placeholder / test-mode friendly, no real keys in this project. See <code>js/stripe-placeholder.js</code> and <code>serverless/create-checkout-session.js</code>. Set <code>stripe.enabled</code> and a <code>pk_test_</code> key in <code>content.json</code> when the client has an account.</p>
          </div>
          <p id="checkout-error" class="error" hidden></p>
          <p style="margin-top:12px"><button class="btn wide" type="submit" id="place-order">Place placeholder order</button></p>
        </form>
        <aside class="panel">
          <h2>Order summary</h2>
          <div id="summary-lines" class="totals"></div>
          <div class="totals">
            <div><span>Subtotal</span><strong id="sum-subtotal">$0.00</strong></div>
            <div id="sum-delivery-row"><span>${escapeHtml(content.delivery.feeLabel)}</span><strong id="sum-delivery">$0.00</strong></div>
            <div id="sum-tax-row" hidden><span>${escapeHtml(content.tax.label)}</span><strong id="sum-tax">$0.00</strong></div>
            <div class="grand"><span>Total</span><strong id="sum-total">$0.00</strong></div>
          </div>
          <p class="fine">${escapeHtml(content.tax.note)}</p>
        </aside>
      </div>
    </section>
  `;

  const form = $("#checkout-form");
  function fulfillment() {
    return (form.querySelector('[name="fulfillment"]:checked') || {}).value || "pickup";
  }
  function syncFulfillment() {
    const method = fulfillment();
    const delivery = method === "delivery";
    $("#delivery-fields").hidden = !delivery;
    ["street", "city", "state", "zip"].forEach((name) => {
      form[name].required = delivery;
    });
    const payPickup = form.querySelector('[name="payment"][value="pickup"]');
    if (delivery && payPickup.checked) form.querySelector('[name="payment"][value="card"]').checked = true;
    payPickup.disabled = delivery;
    $("#pay-pickup-choice").style.opacity = delivery ? "0.55" : "1";
    renderCheckoutSummary(content, method);
    checkZip();
  }
  function checkZip() {
    const err = $("#zip-error");
    if (fulfillment() !== "delivery") { err.hidden = true; return true; }
    const zip = form.zip.value;
    if (!zip) { err.hidden = true; return false; }
    if (!zipAllowed(content, zip)) {
      err.hidden = false;
      err.textContent = "This placeholder delivery area does not include that ZIP. Use one of the demo ZIP codes, or update content.json with the real service area.";
      return false;
    }
    err.hidden = true;
    return true;
  }
  form.addEventListener("change", syncFulfillment);
  form.zip.addEventListener("input", checkZip);
  syncFulfillment();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const err = $("#checkout-error");
    err.hidden = true;
    if (!form.reportValidity()) return;
    if (fulfillment() === "delivery" && !checkZip()) return;

    const method = fulfillment();
    const payment = (form.querySelector('[name="payment"]:checked') || {}).value;
    const t = totals(content, method);
    const order = {
      placeholder: true,
      createdAt: new Date().toISOString(),
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      fulfillment: method,
      payment,
      notes: form.notes.value.trim(),
      address: method === "delivery" ? {
        street: form.street.value.trim(),
        apt: form.apt.value.trim(),
        city: form.city.value.trim(),
        state: form.state.value.trim(),
        zip: String(form.zip.value).replace(/\D/g, "").slice(0, 5)
      } : null,
      lines: t.lines.map((line) => ({ id: line.id, name: line.name, qty: line.qty, unitCents: line.unitCents, lineCents: line.lineCents })),
      subtotalCents: t.subtotalCents,
      deliveryFeeCents: t.deliveryFeeCents,
      taxCents: t.taxCents,
      totalCents: t.totalCents
    };

    if (payment === "card") {
      const result = await window.KaleStripe.startCheckout({
        stripeConfig: content.stripe,
        order,
        successUrl: new URL(content.stripe.successUrl || "order-confirmation.html?payment=stripe", window.location.href).href,
        cancelUrl: new URL(content.stripe.cancelUrl || "checkout.html?payment=cancelled", window.location.href).href
      });
      if (result.reason === "not-configured") {
        order.paymentNote = result.message;
        sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
        setCart([]);
        window.location.href = "order-confirmation.html?payment=placeholder";
        return;
      }
      if (!result.ok) {
        err.hidden = false;
        err.textContent = result.message || "Could not start card payment.";
        return;
      }
      sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
      return;
    }

    order.paymentNote = "Pay at pickup selected. No online payment was collected.";
    sessionStorage.setItem(ORDER_KEY, JSON.stringify(order));
    setCart([]);
    window.location.href = "order-confirmation.html?payment=pickup";
  });
}

function renderConfirmation(content) {
  let order = null;
  try { order = JSON.parse(sessionStorage.getItem(ORDER_KEY) || "null"); } catch (err) { order = null; }
  if (!order) {
    $("#main").innerHTML = `<section class="section wrap"><div class="empty"><h1>No placeholder order found</h1><p><a class="btn" href="menu.html">Back to the menu</a></p></div></section>`;
    return;
  }
  const pay = new URLSearchParams(window.location.search).get("payment");
  const summary = [
    "THE KALE COMPANY — PLACEHOLDER ORDER",
    "Not sent to the restaurant. No payment was processed.",
    "",
    "Name: " + order.name,
    "Phone: " + order.phone,
    "Email: " + order.email,
    "Fulfillment: " + order.fulfillment,
    "Payment: " + order.payment + (pay ? " (" + pay + ")" : ""),
    order.address ? "Address: " + [order.address.street, order.address.apt, order.address.city, order.address.state, order.address.zip].filter(Boolean).join(", ") : "Pickup at the placeholder address",
    "",
    ...order.lines.map((line) => line.qty + " × " + line.name + " — " + money(line.lineCents)),
    "",
    "Subtotal: " + money(order.subtotalCents),
    "Delivery fee: " + money(order.deliveryFeeCents || 0),
    "Tax: " + money(order.taxCents || 0),
    "Total: " + money(order.totalCents),
    "Notes: " + (order.notes || "None"),
    "",
    order.paymentNote || ""
  ].join("\n");
  $("#main").innerHTML = `
    <section class="section wrap">
      <div class="success-box">
        <p class="eyebrow">Preview only</p>
        <h1>Placeholder order received</h1>
        <p>This confirmation is for design and testing. Nothing was charged, emailed, or sent to the kitchen.</p>
        <pre class="order-summary">${escapeHtml(summary)}</pre>
        <p><a class="btn" href="menu.html">Back to the menu</a></p>
      </div>
    </section>
  `;
}

const pages = {
  home: renderHome,
  menu: renderMenu,
  about: renderAbout,
  visit: renderVisit,
  contact: renderContact,
  cart: renderCart,
  checkout: renderCheckout,
  confirmation: renderConfirmation
};

async function showGate() {
  if (!PREVIEW_GATE_ENABLED) return true;
  if (sessionStorage.getItem(AUTH_KEY) === "ok") return true;
  document.body.innerHTML = `
    <main class="gate">
      <form class="gate-card" id="gate-form">
        <img src="assets/logos/logo-header.svg" alt="">
        <p class="eyebrow">PREVIEW – placeholder content</p>
        <h1>The Kale Company preview</h1>
        <p>This is a private placeholder preview, not a live ordering site. Enter the preview password to continue.</p>
        <label>Preview password<input type="password" name="password" required autocomplete="current-password"></label>
        <p id="gate-error" class="error" hidden>That password did not match.</p>
        <p style="margin-top:18px"><button class="btn wide" type="submit">View preview</button></p>
      </form>
    </main>
  `;
  return new Promise((resolve) => {
    $("#gate-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const value = event.target.password.value.trim();
      const hash = await sha256hex(value);
      if (hash === PREVIEW_PASS_SHA256) {
        sessionStorage.setItem(AUTH_KEY, "ok");
        window.location.reload();
        resolve(true);
      } else {
        const err = $("#gate-error");
        err.hidden = false;
      }
    });
  });
}

async function init() {
  const allowed = await showGate();
  if (!allowed) return;
  try {
    CONTENT = await loadContent();
  } catch (err) {
    document.body.innerHTML = `<main class="section wrap"><h1>Could not load the site content</h1><p>Open this preview through a local or hosted web server so <code>content.json</code> can load. From the project folder run:</p><pre class="order-summary">python3 -m http.server 8080</pre></main>`;
    return;
  }
  window.KALE_CONTENT = CONTENT;
  renderChrome(CONTENT);
  const page = currentPage();
  if (pages[page]) pages[page](CONTENT);
  else renderHome(CONTENT);
}

init();
