# ENGRAM BACKUP — POS + Inventario Multi-Sucursal

> Backup integral de todos los aspectos generales y transversales del proyecto.
> Generado: 2026-07-10
> Propósito: Restauración de contexto arquitectónico, decisiones técnicas y modelo de dominio.

---

## 1. VISIÓN GENERAL DEL PRODUCTO

### 1.1 Propósito
Sistema POS + Inventario multi-sucursal para el mercado chileno. Opera como capa intermedia entre WooCommerce y puntos de venta físicos. Resuelve la desconexión crítica entre tienda online y sucursales físicas: stock no sincronizado, ventas presenciales no reflejadas en e-commerce, ausencia de fuente de verdad única.

### 1.2 Mercado Objetivo
- Pymes y mid-market chileno con 2-20 sucursales físicas
- Comercios que ya usan WooCommerce
- Dueños que requieren visibilidad consolidada de inventario y ventas

### 1.3 Diferenciadores
1. **Local-First:** Opera sin conexión a internet gracias a colas con reintentos
2. **Multi-sucursal nativo:** Stock, precios y configuración segregados por sucursal
3. **Zero CORS:** Inertia.js elimina problemas de CORS en hosting compartido
4. **Sin demonios:** Diseñado para cPanel sin procesos persistentes; tareas diferidas via cron

### 1.4 Filosofía de Diseño
Monolito bien modularizado > microservicios. Razón: cliente chileno típico contrata hosting compartido sin capacidad de administrar contenedores ni orquestadores. Un monolito Laravel con boundaries de dominio claros es desplegable, depurable y mantenible por un solo desarrollador.

### 1.5 Modelo Standalone
El sistema corre en subdominio propio (ej. sistema.mi-tienda.cl) con su propia BD Laravel. WordPress/WooCommerce queda separado. La comunicación es exclusivamente por API.

**Ventajas:**
- Aislamiento tecnológico (actualización WooCommerce no rompe POS)
- Stack moderno (Vue 3, Tailwind, Vite sin depender de build de WordPress)
- Escalabilidad independiente
- Seguridad (panel admin no expone rutas WordPress)

### 1.6 Arquitectura Local-First
1. Operación local inmediata (cada transacción POS se registra primero en BD local)
2. Sincronización asíncrona (actualizaciones hacia WooCommerce encoladas)
3. Reintentos automáticos con backoff exponencial
4. Consistencia eventual (WooCommerce no es fuente de verdad; Stock Ledger del POS lo es)

### 1.7 Alcance MVP

**Incluido:**
- POS con venta, descuentos, múltiples medios de pago, impresión ticket
- Catálogo de productos con variantes y precios multi-sucursal
- Inventario por sucursal con transferencias y ajustes
- Sincronización WooCommerce bidireccional (stock, productos, pedidos)
- Gestión de pedidos web y POS
- Roles: Administrador, Supervisor, Vendedor, Bodeguero

**Excluido (Fase 2):**
- Facturación DTE
- Webpay presencial
- Reportes avanzados

**Excluido (Fase 3):**
- App móvil nativa (PWA es paso intermedio)
- Integración contable
- CRM y fidelización

---

## 2. ARQUITECTURA Y TOPOLOGÍA

### 2.1 Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | Laravel 11 | Ecosistema maduro, colas, ORM, migraciones |
| Frontend | Vue 3 + Inertia.js | Elimina CORS, sesión compartida, SPA progresivo |
| CSS | Tailwind CSS 3 | Utilidades atómicas, bundles pequeños |
| BD | MySQL 8 / MariaDB 10.6 | ACID, disponible en todo hosting |
| Colas | DB driver + Cron | Sin dependencia de Redis ni demonios |
| Build | Vite | HMR rápido, tree-shaking |
| E-commerce | WooCommerce (API REST) | Estándar de facto para Chile |

### 2.2 Justificación Inertia.js sobre API stateless
Alternativa descartada (API stateless con Sanctum/Sanctum): requeriría tokens JWT, refresh tokens, CORS headers y doble pipeline de despliegue. En cPanel, cada origen extra es fuente potencial de bugs. Inertia.js reduce integración a una sola capa: frontend y backend comparten mismo origen, sesión y CSRF.

### 2.3 Restricciones de Infraestructura (cPanel)
1. **Sin demonios persistentes:** No hay systemd, supervisor, screen/tmux
2. **Cron mínimo 1 minuto:** Define límite inferior de latencia de colas
3. **Sin Redis/Memcached garantizado:** Driver database es el predeterminado
4. **PHP-FPM limitado:** No viable Laravel Octane
5. **Sin control de servidor web:** Solo .htaccess
6. **Almacenamiento compartido:** I/O intensiva debe minimizarse

### 2.4 Estrategia de Adaptación
- Sin demonios → Cron ejecuta `php artisan queue:work --stop-when-empty` cada minuto
- Sin Redis → Driver database con tabla jobs indexada
- PHP-FPM limitado → Peticiones Inertia ligeras; API calls externalizadas a jobs
- Sin control servidor → Toda lógica de ruteo vive en Laravel
- I/O compartida → Subida a disco local con sync periódico a cloud

### 2.5 Configuración Mínima Hosting
- PHP 8.2+ con BCmath, Ctype, JSON, Mbstring, OpenSSL, PDO, Tokenizer, XML, GD, Zip
- MySQL 8+ (mín 1 GB)
- Node.js 20+ (para compilación Vite) — si no soporta, compilar local y subir public/build/
- Subdominio dedicado con SSL

### 2.6 Contrato de Licenciamiento

**Filosofía:** Maximizar adopción MVP sin fricción. El LicensingStub siempre responde true.

**Diseño:**
```php
interface LicenseValidator {
    public function isValid(string $licenseKey): bool;
    public function getLicenseInfo(string $licenseKey): array;
    public function getDaysRemaining(string $licenseKey): ?int;
}
```

**Implementación MVP:**
```php
class LocalLicenseStub implements LicenseValidator {
    public function isValid(string $licenseKey): bool { return true; }
}
```

**Reemplazo futuro:** Solo cambiar binding en AppServiceProvider:
```php
// MVP:
$this->app->bind(LicenseValidator::class, LocalLicenseStub::class);
// Futuro:
// $this->app->bind(LicenseValidator::class, CloudLicenseService::class);
```

**Principio:** Dependency Inversion — dominio no conoce detalles de infraestructura.

---

## 3. MOTOR DE SINCRONIZACIÓN WOOCOMMERCE

### 3.1 Fuentes de Verdad por Dominio

| Dato | Fuente | Dirección |
|------|--------|-----------|
| Stock | POS (Stock Ledger) | POS → WooCommerce |
| Catálogo (SKU, nombre, precio) | POS | POS → WooCommerce |
| Pedidos web | WooCommerce | WooCommerce → POS |
| Clientes | POS | Bidireccional |
| Precios por sucursal | POS | POS → WooCommerce |
| Imágenes | WooCommerce | WC → POS (URL) |

### 3.2 Reglas de Resolución de Conflictos
- **Stock:** WooCommerce nunca sobreescribe POS
- **Productos:** POS empuja a WC; productos solo-WC se importan como "no vinculados"
- **Pedidos web:** Una vez importados, no se modifican retroactivamente desde WC
- **Clientes:** Última escritura gana; POS prioridad para datos locales

### 3.3 Webhooks Entrantes
| Evento WC | Endpoint POS | Acción |
|-----------|-------------|--------|
| order.created | POST /api/webhooks/order-created | Importar pedido |
| order.updated | POST /api/webhooks/order-updated | Actualizar estado |
| product.updated | POST /api/webhooks/product-updated | Re-sincronizar |
| stock.updated | POST /api/webhooks/stock-updated | Log (no sobreescribe) |

Validación: HMAC-SHA256 con secret compartido.

### 3.4 Jobs Salientes
| Acción POS | Job | Endpoint WC |
|-----------|-----|-------------|
| Crear producto | SyncProductToWooCommerce | POST /wp-json/wc/v3/products |
| Actualizar stock | SyncStockToWooCommerce | PUT /wp-json/wc/v3/products/{id} |
| Transferencia | SyncTransferToWooCommerce | PUT /wp-json/wc/v3/products/{id} |
| Crear cliente | SyncCustomerToWooCommerce | POST /wp-json/wc/v3/customers |

### 3.5 Resiliencia
- Reintentos: 5 con backoff (30s, 2min, 5min, 15min, 30min)
- Dead Letter Queue: failed_jobs con comando para re-encolar
- Idempotencia: UUID en X-Idempotency-Key
- Throttling: middleware throttle de Laravel HTTP Client

---

## 4. DOMINIO INVENTARIO Y CATÁLOGO

### 4.1 Stock Ledger
Principios: inmutabilidad, auditabilidad, trazabilidad.

**Estructura:**
- product_id, branch_id, type (enum)
- quantity (positivo=entrada, negativo=salida)
- balance_after (saldo posterior)
- user_id, reference_type, reference_id
- reason, timestamps

**Cálculo:** Stock disponible = SUM(quantity) sobre ledger filtrado por product_id + branch_id. No hay campo calculado. Para alto volumen: tabla denormalizada actualizada por eventos.

### 4.2 Modelo Sucursales
Entidad branches con: datos contacto, horario (JSON), config POS, usuarios asignados (many-to-many con roles por sucursal), precios propios.

**Transferencias entre sucursales:**
1. Salida (origen): transfer_out, reduce stock, producto "en tránsito"
2. Entrada (destino): transfer_in, incrementa stock

**Reglas:**
- Producto puede existir sin stock en sucursal
- Precios por sucursal opcionales (fallback a precio base)
- Usuario puede tener roles diferentes en distintas sucursales

---

## 5. DOMINIO VENTAS Y PEDIDOS WEB

### 5.1 Rutas de Despacho
Pedidos web importados requieren asignación a sucursal para preparación/despacho.

**Asignación automática:**
1. Obtener comuna de envío del pedido
2. Buscar sucursal con cobertura en esa comuna
3. Fallback: sucursal preferida del cliente
4. Último recurso: sucursal principal

**Estados:** pending_assignment → assigned → preparing → ready_for_pickup → in_delivery → delivered | cancelled

---

## 6. CUMPLIMIENTO Y SEGURIDAD

### 6.1 Ley 21.719 (Protección de Datos)
- Consentimiento explícito (checkbox no pre-seleccionado)
- Derechos ARCO: API exportación, eliminación lógica con anonimización
- Portabilidad: exportación JSON descargable
- Encriptación: AES-256 en reposo, TLS 1.3 en tránsito, bcrypt para passwords
- Notificación de brechas: log de accesos + alertas automáticas
- Retención: configurable, purga automática tras 5 años

### 6.2 Roles y Permisos

| Rol | Permisos Clave | Ámbito |
|-----|---------------|--------|
| Administrador | CRUD todo, reportes, configurar, licencias | Global |
| Supervisor | Reportes sucursal, anular ventas, transferencias, asignar pedidos | Por sucursal |
| Vendedor | Ventas POS, ver stock, registrar clientes | Por sucursal |
| Bodeguero | Recibir transferencias, ajustes, preparar pedidos | Por sucursal |

Implementación: spatie/laravel-permission con pivot table model_branch_roles + middleware CheckBranchAccess.

---

## 7. DECISIONES PENDIENTES (PREGUNTAS ABIERTAS)

### 7.1 Webpay Físico
**Problema:** SDK de Transbank es Java/.NET, requiere bridge con Laravel.
**Arquitectura propuesta:** Bridge Node.js en localhost comunicado por WebSocket con el navegador.
**Alternativa:** Webpay API 2.0 con QR dinámico (sin SDK propietario, sin bridge).
**Decisión:** Evaluar API 2.0 como prioridad.

### 7.2 Facturación DTE
**Opciones:**
1. SII Directo (SOAP, complejo, sin costo tx)
2. PayMe (API REST, SDK moderno, costo mensual)
3. Efact (API REST, amplia adopción)
4. SimpleFact (API REST, económico)

**Preguntas abiertas:**
- ¿Facturar desde POS o WooCommerce?
- ¿Timing: inmediata o diferida?
- ¿Múltiples sucursales con un solo RUT?
- ¿RUT obligatorio para boleta?

**Recomendación:** PayMe para Fase 2 (reduce tiempo de implementación).

---

## 8. DIAGRAMA DE TOPOLOGÍA (SVG)

El diagrama de topología está embebido en `index.html` (sección 2.3) y muestra:

```
[Cliente Web] --HTTP Inertia--> [Laravel Monolith en cPanel]
                                     |
                            [Controladores] --ORM--> [MySQL]
                                     |
                               dispatch() ---> [Cola Jobs]
                                                   ^
                                                   |
                                              [Cron: queue:work]
                                     |
                        --API Sync--> [WooCommerce]
                        <--Webhook--- [WooCommerce]
```

---

## 9. GLOSARIO TÉCNICO

| Término | Definición |
|---------|-----------|
| Stock Ledger | Registro inmutable de movimientos de inventario |
| Sucursal | Entidad con inventario, precios y usuarios propios |
| Local-First | El sistema opera principalmente con datos locales; la sincronización es secundaria |
| Consistencia eventual | El estado externo (WooCommerce) converge al real con rezago controlado |
| Inertia.js | Biblioteca que conecta Laravel con Vue 3 sin API REST |
| Licensing Stub | Implementación local que simula validación de licencia para MVP |
| Ruta de Despacho | Proceso de asignación de pedido web a sucursal para preparación/entrega |
| DTE | Documento Tributario Electrónico (facturación chilena) |
| Webpay | Pasarela de pagos de Transbank (Chile) |
| cPanel | Panel de control de hosting compartido (limitaciones: sin demonios, sin Redis) |

---

## 10. REFERENCIAS Y RECURSOS

- Laravel 11: https://laravel.com/docs/11.x
- Inertia.js: https://inertiajs.com/
- Vue 3: https://vuejs.org/
- WooCommerce REST API: https://woocommerce.github.io/woocommerce-rest-api-docs/
- Tailwind CSS: https://tailwindcss.com/
- Vite: https://vitejs.dev/
- spatie/laravel-permission: https://spatie.be/docs/laravel-permission
- Ley 21.719 (Chile): https://www.bcn.cl/leychile/navegar?idNorma=1193473
- Transbank Webpay: https://www.transbank.cl/
- SII DTE: https://www.sii.cl/validador_factura_electronica/

---

*Fin del backup Engram. Este documento captura todas las decisiones arquitectónicas, reglas de dominio y aspectos transversales del proyecto POS + Inventario Multi-Sucursal.*
