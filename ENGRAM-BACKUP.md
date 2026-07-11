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
4. Consistencia eventual (WooCommerce no es source of truth; Stock Ledger del POS lo es)

### 1.7 Alcance MVP

**Incluido:**
- POS con venta, descuentos, múltiples medios de pago, impresión ticket
- Catálogo de Products con variantes y precios multi-sucursal
- Inventario por sucursal con transferencias y ajustes
- Sincronización WooCommerce bidireccional (stock, products, pedidos)
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

### 2.6 Diccionario de Datos (Esquema MariaDB)

28 Database tables documented in `index.html` (sección 2.5, título "Diccionario de Datos — Esquema MariaDB").

**UI/UX aplicado:**
- **Colapsable:** Cada tabla envuelta en `<details><summary>` — solo se ve el nombre + descripción corta por defecto; clic para expandir los campos.
- **Callouts de reglas de oro:** 3 `warn-box` al inicio destacando (1) Motor InnoDB estricto con FK explícitas, (2) Prohibición de borrado físico (Soft Deletes), (3) Cifrado app-level (Laravel Crypt) para campos Ley 21.719 y credenciales WooCommerce.
- **Enlace al ERD:** Al final, link a `#inventario-erd` para la representación visual de las relaciones.
- CSS de `details`/`summary` agregado a `styles.css` (bordes redondeados, hover, transiciones).

**Grupos:** Configuración (system_configs, license_states), Organización (branches, roles, users, branch_user), Canales (stores), Catálogo (categories, category_store_mappings, attributes, attribute_values, products, product_variants, product_variant_values, product_store_mappings), Stock (stock_movements, current_stock), Caja (cash_sessions), Clientes (customers, customer_store_mappings, customer_privacy_requests), Ventas (sales, sale_items, sale_payments), Sync (sync_events), Auditoría (access_logs), Reportes (daily_sales_summaries, daily_stock_summaries).

FK con RESTRICT priorizado. Índices compuestos críticos en stock_movements y sales. current_stock se recalcula incrementalmente.

### 2.7 Contrato de Licenciamiento

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

### 3.1 Reglas de Verdad
- **Stock:** Bidireccional con jerarquía POS. El POS siempre impone su valor sobre WooCommerce. WooCommerce descuenta para pedidos web, el POS descuenta para ventas presenciales. Ajustes solo desde POS.
- **Catálogo (Products):** Bidireccional con resolución de conflictos. Dos estrategias documentadas:
  - *Estrategia A — "Gana el timestamp más reciente":* Simple, compara updated_at. Vulnerable a skew de reloj (>5s).
  - *Estrategia B — "Bloqueo de campos según origen":* Cada campo tiene dueño definido (sku, price → POS; description, images → WooCommerce). Más robusta pero requiere configuración explícita.
- **Pedidos web:** WooCommerce → POS (unidireccional). Una vez importados no se modifican retroactivamente.
- **Customers:** Bidireccional con última escritura gana.
- **Imágenes:** WooCommerce → POS (referencia por URL).

### 3.2 Fuentes de Verdad

| Dato | Fuente | Dirección |
|------|--------|-----------|
| Stock disponible | POS (Stock Ledger) | POS → WooCommerce (jerarquía POS) |
| Catálogo — SKU, nombre, precio | POS | POS → WooCommerce (según estrategia) |
| Catálogo — descripción, imágenes, categorías | WooCommerce | WooCommerce → POS (según estrategia) |
| Pedidos web | WooCommerce | WooCommerce → POS (unidireccional) |
| Customers | POS | Bidireccional |
| Precios por sucursal | POS | POS → WooCommerce |

### 3.3 Webhooks Entrantes
| Evento WC | Endpoint POS | Acción |
|-----------|-------------|--------|
| order.created | POST /api/webhooks/order-created | Importar pedido como venta en estado `en_transito` |
| order.updated | POST /api/webhooks/order-updated | Actualizar estado y notas internas |
| product.updated | POST /api/webhooks/product-updated | Re-sincronizar campos propiedad de WC |
| product.created | POST /api/webhooks/product-created | Importar como "no vinculado" |
| stock.updated | POST /api/webhooks/stock-updated | Log de auditoría (no sobreescribe POS) |

Validación: HMAC-SHA256 con secret compartido. Los webhooks se procesan dentro de un Job para no bloquear la respuesta HTTP.

### 3.4 Jobs Salientes (REST API asíncrona)
| Evento POS | Job | Endpoint WC | Prioridad |
|-----------|-----|-------------|-----------|
| Crear producto | SyncProductToWooCommerce | POST /wp-json/wc/v3/products | Normal |
| Actualizar stock | SyncStockToWooCommerce | PUT /wp-json/wc/v3/products/{id} | Alta |
| Transferencia | SyncTransferToWooCommerce | PUT /wp-json/wc/v3/products/{id} | Normal |
| Crear/actualizar cliente | SyncCustomerToWooCommerce | POST /wp-json/wc/v3/customers | Baja |
| Actualizar precio | SyncPriceToWooCommerce | PUT /wp-json/wc/v3/products/{id} | Normal |

### 3.5 Reconciliación de Stock
Job programado (`php artisan sync:reconcile-stock`) que cruza el stock total del POS contra WooCommerce. Se ejecuta en ventanas de bajo tráfico (ej. 3:00 AM vía cron). Detecta discrepancias y fuerza la sincronización. Para catálogos >10k productos, usar paginación en la consulta a WooCommerce.

### 3.6 Resiliencia
- Reintentos: 5 con backoff (30s, 2min, 5min, 15min, 30min)
- Dead Letter Queue: failed_jobs con `php artisan sync:retry-all`
- Idempotencia: UUID en X-Idempotency-Key (WooCommerce lo almacena 24h)
- Throttling: middleware throttle de Laravel HTTP Client + semáforo por CanalWoo
- Colas por prioridad: high (stock), normal (products), low (customers)

---

## 4. DOMINIO INVENTARIO Y CATÁLOGO

### 4.1 Stock Ledger
Principios: inmutabilidad, auditabilidad, trazabilidad. Prohibido usar campo de texto plano para stock actual.

**Tipos de movimiento (enum):**
| Tipo | Signo | Descripción | Documento origen |
|------|-------|-------------|-----------------|
| entrada | + | Ingreso por compra/reposición | PurchaseOrder |
| salida | − | Egreso por devolución/merma | WastageNote |
| venta_pos | − | Descuento por venta presencial | Sale (origen pos) |
| venta_web | − | Descuento por pedido web | Sale (origen web) |
| ajuste | ± | Corrección manual (razón obligatoria) | StockAdjustment |
| inicial | + | Saldo inicial de carga | InitialStock |
| transfer_out | − | Salida por transferencia a otra sucursal | Transfer (origen) |
| transfer_in | + | Entrada por recepción de transferencia | Transfer (destino) |
| reserva_en_transito | − | Reserva temporal para pedido web no confirmado | Sale (estado reservado) |
| reversion | ± | Contrapartida de movimiento anterior | Documento original |

**Estructura:**
- product_id, branch_id, type (string), quantity (int, ±)
- balance_after (saldo posterior calculado al insertar)
- user_id, reference (nullableMorphs), reason
- Index: (product_id, branch_id, created_at)

**Cálculo:** Stock disponible = SUM(quantity). Stock real = exclude `reserva_en_transito`. Para >100k movimientos: tabla denormalizada `branch_product_stock` actualizada por eventos.

### 4.2 Sucursales y Canales Web

**Branch (branches):** Entidad con datos de contacto, horario (JSON), config POS, usuarios (N:M con roles por sucursal), precios propios (vía pivot branch_product), stock segregado, cobertura de despacho.

**CanalWoo:** Representa una tienda WooCommerce conectada. Cada canal tiene sus propias credenciales API y webhook secret. Un cliente puede tener múltiples canales (retail, B2B, etc.).

- `stores`: id, branch_id (FK), nombre, url, api_key (encrypted), api_secret (encrypted), webhook_secret (encrypted), activo, config (JSON)
- `product_store_mappings`: (product_id, store_id) → woo_id, woo_sku. Unique por par. Cada producto tiene un ID remoto distinto por canal.

**Transferencias:** proceso de 2 pasos: transfer_out (origen, -stock), transfer_in (destino, +stock).

**Reglas:**
- Product sin stock aparece en catálogo como no disponible
- Precios por sucursal opcionales (fallback a precio base)
- User con roles diferentes por sucursal
- Stock global solo para reportes

### 4.3 Diagrama Entidad-Relación
Diagrama SVG embebido en `index.html` (sección 4.3). Entidades: User, Role, Branch, CanalWoo, Product, Customer, Sale, StockMovement. Pivots: branch_product, product_store_mappings. Relaciones N:M entre User-Role y User-Branch. 1:N: Branch→CanalWoo, Branch→Sale, Product→StockMovement, Customer→Sale.

---

## 5. DOMINIO VENTAS Y PEDIDOS WEB

### 5.1 Rutas de Despacho
Tres modos de asignación de pedidos web a sucursal:

- **Modo A — Sucursal fija/Bodega central:** Todos los pedidos se asignan a la sucursal default del CanalWoo. Sin intervención manual. Ideal para un solo punto de despacho.
- **Modo B — Selección manual por supervisor:** Pedidos llegan a buzón de asignación (estado `pending_assignment`). Supervisor elige sucursal. Soporte MVP para multi-sucursal.
- **Modo C — Enrutamiento geográfico (backlog Fase 2):** Asignación automática por comuna de envío. Requiere tabla de cobertura, validación de stock, reglas de costo/tiempo. Usa Modo B como fallback.

**Estados:** pending_assignment → assigned → preparing → ready_for_pickup → in_delivery → delivered | cancelled. Cada cambio actualiza el estado en WooCommerce vía API REST.

---

## 6. CUMPLIMIENTO Y SEGURIDAD

### 6.1 Privacidad por Diseño (Ley 21.719)

**Minimización de datos:** Solo recolectar RUT, nombre, email y teléfono como obligatorios. Datos demográficos opcionales con consentimiento adicional.

**Cifrado en reposo:** RUT, email y teléfono se almacenan con AES-256 (librería `lakm/laravel-encrypted-trait`). Se indexa hash SHA-256 del RUT para búsquedas. Email almacena hash auxiliar para login.

**Consentimiento explícito:** Tabla `customer_consents` con customer_id, purpose (marketing|data_processing|sharing_third_party), granted, ip_address, policy_version. Checkbox no pre-seleccionado. Revocable desde el perfil del cliente.

**Derecho al olvido:** Endpoint que verifica obligaciones legales (facturas con DTE → retención 5 años). Si hay obligaciones: anonimización (reemplazar datos por valores irreversibles). Si no: eliminación completa + anonimización de referencias en ventas históricas. Todo auditado.

**Rectificación:** Customer actualiza datos desde su perfil. Cada cambio se registra en `customer_data_changes` (valor anterior, nuevo, fecha, IP) para reconstrucción de historial.

**Retención:** Configurable. Purga automática tras 5 años sin actividad.

### 6.2 Matriz de Roles MVP

Roles acumulativos (cada uno hereda del anterior):

| Rol | Ámbito | Permisos clave |
|-----|--------|---------------|
| **Cajero** | Su sucursal | POS (vender, abrir/cerrar caja, ticket), ver stock (lectura), registrar customers, historial propio |
| **Supervisor** | Su sucursal | Todo Cajero + anular ventas, transferencias stock, asignar pedidos web (Modo B), ajustes inventario, reportes sucursal |
| **Admin Central** | Global | Todo Supervisor (cualquier sucursal) + CRUD products/branches/users/Woo channels, configurar WooCommerce, reportes consolidados, licencias, auditoría |

**Implementación:** spatie/laravel-permission con pivot table `model_branch_roles` (user_id, role_id, branch_id). Middleware `CheckBranchAccess`. Roles globales con branch_id=null. RoleHierarchyService para jerarquía acumulativa.

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

## 8. ESTRUCTURA Y OPERACIÓN INTERNA

### 8.1 Core Backend: Directorios (DDD Ligero)
Se rechaza la estructura MVC plana en favor de `app/Domain/<Nombre>/` con Models, Actions, Jobs y Rules autocontenidos por módulo.

**Módulos:**
- `Domain/Identity/`: Users, Roles, autenticación, consentimiento Ley 21.719
- `Domain/Inventory/`: Products, StockMovement, Branches, ajustes y transferencias
- `Domain/Sales/`: Sales, Customers, Payments, rutas de despacho
- `Domain/Sync/`: CanalWoo, Jobs de sincronización, WebhookHandlers, WooCommerceApiClient, resolutores de conflictos (FieldOwnershipResolver, TimestampConflictResolver)
- `Domain/Reporting/`: Pre-agregación, tablas de resumen

**Principios:** Controllers delgados, Actions con una responsabilidad, Jobs en su dominio, Enums y DTOs tipifican el dominio.

### 8.2 Reportería y Rendimiento (Pre-agregación)
Regla de oro: prohibido calcular reportes en tiempo real sobre tablas transaccionales. Jobs programados consolidan datos en tablas de resumen.

**Jobs:**
- `AggregateDailySales`: Cada 30-60 min, agrupa sales por sucursal × método de pago × fecha → `daily_sales_summaries`
- `SnapshotStock`: Cada 15-30 min, foto del stock por product × sucursal → `stock_snapshots`

**Tablas de resumen:**
| Tabla | Propósito | Frecuencia |
|-------|-----------|------------|
| daily_sales_summaries | Sales aggregated | 30-60 min |
| stock_snapshots | Foto de stock | 15-30 min |
| branch_product_stock | Stock actual denormalizado | Tiempo real (eventos) |
| monthly_sales_summaries | Agregación mensual | Diario |

**Latencia aceptada:** Reportes con hasta 60 min de retraso. Toda transacción POS debe completarse en <500ms.

---

## 9. FRONTERA DEL MVP Y BACKLOG FASE 2

### 9.1 Límites del MVP

| Funcionalidad | MVP | Fase 2 | Fase 3 |
|---------------|-----|--------|--------|
| POS con ventas y descuentos | Sí | — | — |
| Webpay presencial | No (manual) | Bridge Node.js o API 2.0 | — |
| Facturación DTE | No (comprobante interno) | Integración PayMe | — |
| Modo Offline | No (requiere conexión) | — | PWA + IndexedDB |
| Enrutamiento geográfico | No (Modo A/B) | Algoritmo + cobertura | — |
| Tracking courier | No (manual) | API por proveedor | — |
| Reportes en tiempo real | No (latencia 30-60 min) | Caché Redis | — |

---

## 10. DIAGRAMA DE TOPOLOGÍA (SVG)

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
| Branch | Entidad con inventario, precios y usuarios propios |
| CanalWoo | Representación de una tienda WooCommerce conectada (credenciales API, webhook secret) |
| Local-First | El sistema opera principalmente con datos locales; la sincronización es secundaria |
| Consistencia eventual | El estado externo (WooCommerce) converge al real con rezago controlado |
| Inertia.js | Biblioteca que conecta Laravel con Vue 3 sin API REST |
| Licensing Stub | Implementación local que simula validación de licencia para MVP |
| Ruta de Despacho | Proceso de asignación de pedido web a sucursal para preparación/entrega |
| DTE | Documento Tributario Electrónico (facturación chilena) |
| Webpay | Pasarela de pagos de Transbank (Chile) |
| cPanel | Panel de control de hosting compartido (limitaciones: sin demonios, sin Redis) |
| En_tránsito | Estado inicial de un pedido web importado, previo a asignación de sucursal |
| Reconciliación | Job programado que cruza stock POS vs WooCommerce para detectar discrepancias |
| Bloqueo de campos | Estrategia de resolución de conflictos donde cada campo tiene un sistema propietario |
| Pinia | Librería de state management para Vue 3, usada exclusivamente para el carrito del POS |
| useBarcodeScanner | Composable Vue que captura input de pistolas de código de barras vía listener global keydown |
| Pre-agregación | Jobs programados que consolidan datos transaccionales en tablas de resumen para reportes |
| Snapshot | Foto del stock por producto × sucursal en un instante, almacenada para consultas históricas |

---

## 11. PATRONES Y SERVICIOS DE BACKEND

Tres páginas nuevas agregadas al portal en sección 11, extraídas de decisiones ya documentadas:
Posteriormente se agregaron dos páginas más: 3.4 (Flujo BPMN de Sincronización) y 10.2 (Maquetas y Wireframes), junto con buscador, modo oscuro y animaciones CSS en el portal.

### 11.1 Motor de Colas y Cron
Consolidación de todo lo relativo a la ejecución diferida en cPanel:
- Pipeline: dispatch → tabla jobs → cron (cada 1 min) → queue:work --stop-when-empty
- Driver database (no Redis), colas por prioridad high/normal/low
- Backoff: 5 intentos (30s, 2min, 5min, 15min, 30min)
- Dead Letter Queue: failed_jobs + sync:retry-all
- Idempotencia: UUID en X-Idempotency-Key
- Throttling: 25 req/s por CanalWoo
- Tabla completa de todos los jobs del sistema con su frecuencia y programación cron
- Entradas cron reales para copiar/pegar en cPanel

### 11.2 Servicios Transversales
Componentes de infraestructura definidos por contrato:
- LicenseValidator (interface) + LocalLicenseStub (implementación MVP)
- RoleHierarchyService con jerarquía Cajero(1) → Supervisor(2) → AdminCentral(3)
- WooCommerceApiClient en Domain/Sync/Clients/
- Conflict Resolvers: TimestampConflictResolver y FieldOwnershipResolver

### 11.3 Middleware y Seguridad en Rutas
- CheckBranchAccess: verifica rol del usuario en la sucursal activa
- VerifyWebhookSignature: HMAC-SHA256 con secreto por CanalWoo
- Gates del sistema (pos-operate, void-sale, manage-woo-channels, view-cross-reports)

---

## 10. GUÍA DE DESARROLLO

### 10.1 Frontend: Vue 3 + Inertia

**Manejo de Estado (regla de dos vías):**
- CRUDs administrativos → solo props de Inertia.js (sin estado global en el cliente)
- Carrito del POS → Pinia store con persistencia en localStorage (`pinia-plugin-persistedstate` o `@vueuse/core`)

**Lectura de código de barras:** Listener global `keydown` con buffer de caracteres y umbral de 100ms entre teclas para distinguir escáner (sin pausas) de humano tipeando (con pausas). Si el buffer acumula ≥4 caracteres seguidos de Enter, se dispara la búsqueda del producto. Implementado como composable `useBarcodeScanner.js`.

**Arquitectura de componentes por dominio:**
```
Pages/POS/{Index,Cart,Checkout}.vue
Pages/Inventory/{ProductList,ProductForm,StockAdjustment,Transfers}.vue
Pages/Admin/{Branches,CanalWoo,Users}/...
Pages/Reports/{SalesSummary,StockHistory}.vue
Components/Ui/{BaseButton,BaseInput,BaseModal,BaseTable}.vue (reutilizables, sin lógica de negocio)
Composables/useBarcodeScanner.js, usePosCart.js, useBranchSession.js
stores/usePosCartStore.js (único store Pinia permitido)
Layouts/{AppLayout,PosLayout}.vue
```

### 10.2 Hoja de Ruta de Desarrollo

Secuencia lógica de 6 pasos. No hay fechas ni estimaciones. Cada paso tiene un hito verificable.

| Paso | Nombre | Depende de | Hito |
|------|--------|-----------|------|
| 1 | Fundaciones (Laravel+Vue+Inertia, DB, Auth, Roles) | — | Login con 3 roles funcionales |
| 2 | Core Admin (CRUD Branches, CanalWoo, Users, Licencia) | Paso 1 | Admin crea branch, canal y user |
| 3 | Motor Inventario (Catálogo, Stock Ledger, 10 tipos movimiento) | Paso 2 | Ledger con trazabilidad correcta |
| 4 | Frontend POS (Carrito Pinia, Barcode, Cobrar, Comprobante) | Paso 3 | Sale completa descuenta stock |
| 5 | Integración WooCommerce (REST, Webhooks, Despachos) | Paso 4 | Sync bidireccional funcional |
| 6 | Reportería + Reconciliación + Deploy cPanel | Pasos 1-5 | Sistema operando en hosting real |

---

## 10. PROTOCOLO DE MANTENCIÓN DE LA DOCUMENTACIÓN

### 10.1 Regla de oro: relinkear siempre
Cada vez que se agregue una página nueva, se corrija o se modifique contenido existente en `index.html`, se debe:
1. **Relinkear los conceptos afectados:** revisar todas las páginas donde aparezcan los términos modificados y actualizar/agregar los enlaces cruzados (`<a href="#" data-page="...">`) correspondientes.
2. **Buscar puntos de impacto aguas arriba y abajo:** antes de tocar una página, identificar qué otras secciones referencian ese concepto y ajustar la info o los links en ellas. Ejemplo: si se cambia la estructura del Stock Ledger, revisar `sincronizacion-*`, `inventario-*`, `backend-guide-*` y `hoja-ruta-pasos`.
3. **No dejar enlaces huérfanos:** si se elimina una página, eliminar o redirigir todos los links que apuntaban a ella.

### 10.2 Mapa de impacto crítico
| Concepto / Página | Impacta en |
|---|---|
| `vision-general-modelo-standalone` | sincronizacion-*, backend-guide-*, hoja-ruta-pasos |
| `inventario-stock-ledger` (Stock Ledger) | sincronizacion-*, ventas-*, backend-guide-servicios, backend-guide-rutas, hoja-ruta-pasos |
| `inventario-sucursales` (Sucursales) | vision-general-*, sincronizacion-*, backend-guide-rutas, hoja-ruta-pasos |
| `sincronizacion-webhooks` | inventario-*, backend-guide-middleware, backend-guide-rutas, hoja-ruta-pasos |
| `backend-guide-queues` (Colas + Cron) | arquitectura-*, sincronizacion-*, backend-guide-*, hoja-ruta-pasos |
| `cumplimiento-roles` | vision-general-*, backend-guide-middleware, backend-guide-rutas |
| `frontend-guide-vue` | vision-general-*, arquitectura-stack, hoja-ruta-pasos |
| `hoja-ruta-pasos` | todas las secciones (dependencia inversa: cambios en cualquier paso afectan la ruta) |

### 10.3 Checklist antes de cerrar una edición
- [ ] ¿Agregué/quitaré páginas? → actualizar `navigation.js` y relinkear.
- [ ] ¿Toqué conceptos clave (Stock Ledger, cron, roles, sincronización)? → revisar mapa de impacto.
- [ ] ¿Cambió la estructura de archivos del repo? → actualizar `interna-directorios` y `arquitectura-stack`.
- [ ] ¿Cambió el alcance del MVP? → actualizar `vision-general-alcance-mvp` y `frontera-limites`.
- [ ] ¿Corrí errores en tablas, rutas o ejemplos de código? → verificar que no haya info contradictoria en otras secciones.

---

## 11. REFERENCIAS Y RECURSOS

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
