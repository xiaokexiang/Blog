const container = document.querySelector(".container");
const menu = document.querySelector(".menu");
const mobileMenuTrigger = document.querySelector(".menu-trigger");
const desktopMenu = document.querySelector(".menu__inner--desktop");
const desktopMenuTrigger = document.querySelector(".menu__sub-inner-more-trigger");
const menuMore = document.querySelector(".menu__sub-inner-more");
const mobileQuery = getComputedStyle(document.body).getPropertyValue("--phoneWidth");
const isMobile = () => window.matchMedia(mobileQuery).matches;
const handleMenuClasses = () => {
  mobileMenuTrigger && mobileMenuTrigger.classList.toggle("hidden", !isMobile());
  menu && menu.classList.toggle("hidden", isMobile());
  menuMore && menuMore.classList.toggle("hidden", !isMobile());
};
let scorll_event = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;

// Common

menu && menu.addEventListener("click", e => e.stopPropagation());
menuMore && menuMore.addEventListener("click", e => e.stopPropagation());

handleMenuClasses();

document.body.addEventListener("click", () => {
  if (!isMobile() && menuMore && !menuMore.classList.contains("hidden")) {
    menuMore.classList.add("hidden");
  } else if (isMobile() && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
  }
});

window.addEventListener("resize", handleMenuClasses);

// toc top
window.addEventListener("scroll", () => {
  const size = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
  const toc = document.getElementById("toc_id")
  if (toc !== null) {
    document.getElementById("toc_id").style.top = 200 + size + 'px';
  }
});

// Mobile menu

mobileMenuTrigger &&
  mobileMenuTrigger.addEventListener("click", e => {
    e.stopPropagation();
    menu && menu.classList.toggle("hidden");
  });

// Desktop menu

desktopMenuTrigger &&
  desktopMenuTrigger.addEventListener("click", e => {
    e.stopPropagation();
    menuMore && menuMore.classList.toggle("hidden");

    if (menuMore.getBoundingClientRect().right > container.getBoundingClientRect().right) {
      menuMore.style.left = "auto";
      menuMore.style.right = 0;
    }
  });