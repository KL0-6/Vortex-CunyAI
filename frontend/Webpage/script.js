// ── Navbar scroll effect ──
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// ── Intersection Observer for fade-up animations ──
const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -40px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));

// ── Smooth scroll for anchor links ──
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ── Animated counters ──
function animateCounter(el, target, suffix = '') {
  let current = 0;
  const duration = 2000;
  const step = target / (duration / 16);
  const isDecimal = String(target).includes('.');

  function update() {
    current += step;
    if (current >= target) {
      el.textContent = (isDecimal ? target.toFixed(1) : Math.floor(target)) + suffix;
      return;
    }
    el.textContent = (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
    requestAnimationFrame(update);
  }
  update();
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const el = entry.target;
      const target = parseFloat(el.dataset.target);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-counter]').forEach((el) => counterObserver.observe(el));

// ── Screenshot carousel ──
const screenshots = document.querySelectorAll('.screenshot-slide');
let currentSlide = 0;

if (screenshots.length > 1) {
  setInterval(() => {
    screenshots[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % screenshots.length;
    screenshots[currentSlide].classList.add('active');
  }, 4000);
}

// ── Parallax effect on hero ──
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const heroGlow = document.querySelector('.hero-glow');
  if (heroGlow && scrolled < 800) {
    heroGlow.style.transform = `translateX(-50%) translateY(${scrolled * 0.15}px)`;
  }
});
