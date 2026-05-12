Actúa como arquitecto y diseñador senior de Power Platform especializado en Power Apps Code Apps (React) y Dataverse.

OBJETIVO
Quiero diseñar una app corporativa para gestión de proyectos que combine conceptos de Microsoft Project (planificación / Gantt / dependencias) con Jira (Kanban / estados / backlog). La app debe gestionar múltiples proyectos simultáneamente. Cada WorkItem pertenece a un único proyecto.

CONTEXTO ORGANIZATIVO
- Yo (IT) soy el jefe de proyecto y administrador de la app (rol Admin IT).
- Existe un proveedor externo (rol Provider) que NO tendrá acceso a Jira/Confluence corporativo, y trabajará dentro de esta app.
- Existen usuarios de negocio (rol Business/Reader/Editor según aplique) que validan y prueban.

REQUISITOS CLAVE
1) MODELO DE DATOS (Dataverse)
Define tablas recomendadas y campos mínimos:
- Project
- Epic/Feature (opcional)
- WorkItem (tarea) con jerarquía (WorkItem y SubWorkItem o tabla SubTask)
- Estados (State) y Transiciones (StateTransition)
- Roles (AppRole) y permisos por transición
- Asignación por rol (AssignedToRole) y opcionalmente asignación a usuario (AssignedToUser)
- Comentarios/Activity log
- Evidencias (Evidence) vinculadas a cambios de estado o entregables
- Riesgos/Bloqueos (opcional)

2) MÁQUINA DE ESTADOS
- Diseña una máquina de estados configurable (ej: Nuevo, Refinamiento, En curso, Bloqueado, Listo para pruebas, En pruebas, Aceptado, Cerrado).
- Las transiciones deben depender del rol (Admin IT, Provider, Business).
- Debe existir una tabla de transiciones permitidas por rol.
- Cuando se cambia de estado, define reglas para reasignar automáticamente a un rol (por ejemplo: si Provider pone "Listo para pruebas", se asigna a IT o Business según tipo de prueba).
- Evitar ambigüedad: si existe "En curso" para Provider y para IT, propón estrategia para diferenciarlo (p.ej. mismo estado pero diferente OwnerRole; o estados distintos; o swimlanes por rol).

3) EXPERIENCIA DE USUARIO (UX)
- Diseño moderno, corporativo, estilo Microsoft (clean, con tarjetas, pills/chips para estados, accesible).
- Vistas principales:
  - Home Dashboard (KPIs: items por estado, bloqueos, lead time, etc.)
  - Lista de proyectos
  - Vista proyecto: Tabs para Backlog, Kanban, Gantt, Evidencias, Actividad
  - WorkItem details: panel lateral con campos, historia, comentarios, evidencias, cambios de estado
- Controlar visibilidad/acciones según rol.

4) KANBAN Y GANTT
- Kanban por proyecto configurable por estados.
- Gantt por proyecto con dependencias básicas, fechas, y progreso.
- Propón cómo implementar: componentes React, estructura, y cómo persistir cambios en Dataverse.
- Incluye “zoom” y scroll en Gantt si aplica.

5) GOBERNANZA, SEGURIDAD Y AUDITORÍA
- Propuesta de seguridad: roles Dataverse, equipos, security groups, y tablas sensibles.
- Auditoría: registrar quién cambió qué y cuándo (Activity log).
- Evidencias: al pasar a ciertos estados (Listo para pruebas / Aceptado / Cerrado) pedir evidencia (link, archivo, comentario, captura, etc.).
- Considerar el riesgo de “poner cosas nosotros mismos” que luego requieran evidencias: sugiere controles.

6) NOTIFICACIONES
- Notificaciones por cambios de estado (Teams/email) pero sin depender de mi cuenta personal (usar cuenta de servicio / application user / técnica recomendada).
- Define el patrón recomendado.

ENTREGABLES
A) Diseño de arquitectura a alto nivel (bullets + diagrama textual o mermaid).
B) Definición de tablas y campos (con tipos de dato).
C) Definición de máquina de estados (estados + transiciones + reglas por rol).
D) Diseño UX: pantallas, navegación, componentes.
E) Plan de implementación por fases (MVP -> v2 -> v3).
F) Lista de riesgos y decisiones (trade-offs).

RESTRICCIONES
- La app debe ser usable rápido (MVP en poco tiempo).
- El proveedor debe tener acceso limitado, controlado por rol.
- Todo debe ser multi-proyecto y con trazabilidad.

Devuélvelo de forma estructurada y lista para que un equipo dev lo implemente.
