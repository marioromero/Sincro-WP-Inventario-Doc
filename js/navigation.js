(function() {
  'use strict';

  // --- Section definitions ---
  // Each section: { id, number, title, subs: [{ id, title }] }
  const sections = [
    {
      id: 'vision-general', number: '01', title: 'Visión General del Producto',
      subs: [
        { id: 'contexto', title: 'Contexto del Producto' },
        { id: 'modelo-standalone', title: 'Modelo Standalone (Local-First)' },
        { id: 'alcance-mvp', title: 'Alcance del MVP' }
      ]
    },
    {
      id: 'arquitectura', number: '02', title: 'Arquitectura y Topología',
      subs: [
        { id: 'stack', title: 'Stack Tecnológico' },
        { id: 'infraestructura', title: 'Infraestructura cPanel' },
        { id: 'diagrama-topologia', title: 'Diagrama de Topología' },
        { id: 'licenciamiento', title: 'Contrato de Licenciamiento' },
        { id: 'diccionario', title: 'Diccionario de Datos' }
      ]
    },
    {
      id: 'sincronizacion', number: '03', title: 'Motor de Sincronización con WooCommerce',
      subs: [
        { id: 'reglas-verdad', title: 'Reglas de Verdad' },
        { id: 'webhooks', title: 'Webhooks y Sincronización' },
        { id: 'reconciliacion', title: 'Reconciliación de Stock' }
      ]
    },
    {
      id: 'inventario', number: '04', title: 'Dominio: Inventario y Catálogo',
      subs: [
        { id: 'stock-ledger', title: 'Stock Ledger' },
        { id: 'sucursales', title: 'Sucursales y Canales' },
        { id: 'erd', title: 'Diagrama Entidad-Relación' }
      ]
    },
    {
      id: 'ventas', number: '05', title: 'Dominio: Ventas y Pedidos Web',
      subs: [
        { id: 'rutas-despacho', title: 'Rutas de Despacho' }
      ]
    },
    {
      id: 'cumplimiento', number: '06', title: 'Cumplimiento y Seguridad',
      subs: [
        { id: 'privacidad', title: 'Privacidad (Ley 21.719)' },
        { id: 'roles', title: 'Roles y Permisos' }
      ]
    },
    {
      id: 'preguntas', number: '07', title: 'Preguntas Abiertas',
      subs: [
        { id: 'webpay-fisico', title: 'Webpay Físico' },
        { id: 'facturacion-dte', title: 'Facturación DTE' }
      ]
    },
    {
      id: 'interna', number: '08', title: 'Estructura y Operación Interna',
      subs: [
        { id: 'directorios', title: 'Core Backend: Directorios' },
        { id: 'reporteria', title: 'Reportería y Rendimiento' }
      ]
    },
    {
      id: 'frontera', number: '09', title: 'Frontera del MVP y Backlog Fase 2',
      subs: [
        { id: 'limites', title: 'Límites y Exclusiones del MVP' }
      ]
    },
    {
      id: 'guia', number: '10', title: 'Guía de Desarrollo',
      subs: [
        { id: 'frontend', title: 'Frontend: Vue 3 + Inertia' },
        { id: 'hoja-ruta', title: 'Hoja de Ruta (Paso a Paso)' }
      ]
    }
  ];

  // --- Initialize sidebar ---
  const nav = document.getElementById('sidebar-nav');
  let navHTML = '';
  sections.forEach((sec, idx) => {
    navHTML += `<div class="section" data-section="${sec.id}">`;
    navHTML += `<div class="section-header" data-target="${sec.id}">`;
    navHTML += `<span class="arrow">&#9654;</span>`;
    navHTML += `<span class="num">${sec.number}</span>`;
    navHTML += `<span>${sec.title}</span>`;
    navHTML += `</div>`;
    navHTML += `<div class="subsection-list">`;
    sec.subs.forEach(sub => {
      navHTML += `<a href="#" data-page="${sec.id}-${sub.id}">${sub.title}</a>`;
    });
    navHTML += `</div></div>`;
  });
  nav.innerHTML = navHTML;

  // --- Page content registry ---
  const pages = {};
  document.querySelectorAll('.page').forEach(el => { pages[el.id] = el; });

  // --- Navigation ---
  const subsectionLinks = nav.querySelectorAll('.subsection-list a');
  const sectionHeaders = nav.querySelectorAll('.section-header');

  function showPage(pageId) {
    // Hide all pages
    Object.values(pages).forEach(p => p.classList.remove('active'));
    // Show target
    const target = pages[pageId];
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    // Update active link
    subsectionLinks.forEach(a => a.classList.remove('active'));
    const activeLink = nav.querySelector(`a[data-page="${pageId}"]`);
    if (activeLink) activeLink.classList.add('active');
    // Open parent section
    const sectionId = pageId.split('-').slice(0, -1).join('-');
    // Handle multi-word section IDs properly
    let parentSec = null;
    sections.forEach(s => {
      if (pageId.startsWith(s.id + '-')) parentSec = s.id;
    });
    if (parentSec) {
      const parentDiv = nav.querySelector(`.section[data-section="${parentSec}"]`);
      if (parentDiv) parentDiv.classList.add('open');
    }
    // Update URL hash (without scrolling)
    history.replaceState(null, '', '#' + pageId);
  }

  // Click on subsection links
  subsectionLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      showPage(a.dataset.page);
    });
  });

  // Click on section headers to toggle open/close
  sectionHeaders.forEach(h => {
    h.addEventListener('click', () => {
      const parent = h.parentElement;
      const isOpen = parent.classList.contains('open');
      // Close all sections
      document.querySelectorAll('.section').forEach(s => s.classList.remove('open'));
      if (!isOpen) parent.classList.add('open');
    });
  });

  // --- Initial load from hash ---
  function loadFromHash() {
    const hash = window.location.hash.replace('#', '');
    if (hash && pages[hash]) {
      showPage(hash);
    } else {
      // Default: show first page of first section
      const firstId = sections[0].id + '-' + sections[0].subs[0].id;
      showPage(firstId);
    }
  }

  window.addEventListener('hashchange', loadFromHash);
  loadFromHash();

})();
