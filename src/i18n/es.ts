/**
 * Spanish dictionary.
 *
 * This is the only place where user facing text lives. Every key can be
 * overridden per company through the `Translation` table, so an operator can
 * rename "Préstamos" to "Créditos" without touching the code.
 */

export const es = {
  common: {
    appName: "Inversiones JCJ",
    tagline: "Gestión de préstamos, cobros y créditos",
    save: "Guardar",
    saving: "Guardando…",
    cancel: "Cancelar",
    close: "Cerrar",
    // Al tocar una foto: se abre grande, que es para lo que uno la toca.
    zoom: "Ampliar la foto",
    downloadPhoto: "Descargar la foto",
    sharePhoto: "Compartir la foto",
    sharingPhoto: "Preparando…",
    // Cuando el navegador no sabe pasar archivos a otra aplicación: se
    // descarga, que es lo único que queda por hacer, y se dice.
    sharePhotoFallback:
      "Tu navegador no puede compartir archivos. La foto se descargó: adjúntala desde ahí.",
    create: "Crear",
    edit: "Editar",
    delete: "Eliminar",
    remove: "Quitar",
    confirm: "Confirmar",
    search: "Buscar",
    searchPlaceholder: "Buscar…",
    filter: "Filtrar",
    filters: "Filtros",
    clear: "Limpiar",
    all: "Todos",
    none: "Ninguno",
    yes: "Sí",
    no: "No",
    back: "Volver",
    next: "Siguiente",
    previous: "Anterior",
    view: "Ver",
    details: "Detalle",
    actions: "Acciones",
    // --- Ordenar la lista a mano ---
    dragHint:
      "Arrastra una fila para organizarla. En el celular, mantenla pulsada primero.",
    resetOrder: "Volver al orden automático",
    orderedByHand: "Esta lista está ordenada a mano.",
    export: "Exportar",
    print: "Imprimir",
    download: "Descargar",
    total: "Total",
    subtotal: "Subtotal",
    balance: "Balance",
    date: "Fecha",
    amount: "Monto",
    status: "Estado",
    notes: "Notas",
    optional: "Opcional",
    required: "Obligatorio",
    loading: "Cargando…",
    empty: "No hay información para mostrar",
    emptyHint: "Cuando registres información aparecerá aquí.",
    error: "Ocurrió un error",
    retry: "Reintentar",
    today: "Hoy",
    yesterday: "Ayer",
    thisWeek: "Esta semana",
    thisMonth: "Este mes",
    from: "Desde",
    to: "Hasta",
    of: "de",
    page: "Página",
    results: "resultados",
    seeAll: "Ver todo",
    add: "Agregar",
    select: "Seleccionar",
    selectOne: "Selecciona una opción",
    copy: "Copiar",
    copied: "Copiado",
    addPhoto: "Tomar o subir foto",
    takePhoto: "Tomar foto",
    uploadImage: "Subir imagen",
    changePhoto: "Cambiar foto",
    uploading: "Subiendo…",
    enabled: "Activo",
    disabled: "Inactivo",
    enable: "Activar",
    disable: "Desactivar",
    unsavedChanges: "Tienes cambios sin guardar",
    deleteConfirm: "¿Seguro que deseas eliminar este registro?",
    deleteWarning: "Esta acción no se puede deshacer.",
  },

  profile: {
    title: "Mi perfil",
    changePassword: "Cambiar mi contraseña",
    changePasswordHint:
      "Al cambiarla se cierran tus sesiones en los demás dispositivos.",
    currentPassword: "Contraseña actual",
    newPassword: "Contraseña nueva",
    repeatPassword: "Repetir la contraseña nueva",
    passwordChanged: "Listo, tu contraseña quedó cambiada.",
    defaultPasswordWarning:
      "Estás usando la contraseña que trae el sistema de fábrica. Cámbiala ahora: está publicada en la documentación y cualquiera podría entrar.",
  },

  signUp: {
    title: "Crea tu financiera",
    subtitle:
      "Unos datos y empiezas a trabajar. El resto se configura después.",
    companyName: "Nombre de la financiera",
    companyNameHint: "Como lo conocen tus clientes.",
    country: "¿En qué país operas?",
    countryHint:
      "Define la moneda, la zona horaria y cómo se escriben los montos.",
    ownerName: "Tu nombre completo",
    ownerEmail: "Tu correo electrónico",
    ownerEmailHint: "Con este correo vas a entrar al sistema.",
    ownerUsername: "Nombre de usuario",
    ownerUsernameHint:
      "Para entrar sin escribir el correo. Letras, números, punto, guion y guion bajo.",
    password: "Contraseña",
    passwordHint: "Mínimo 8 caracteres.",
    passwordRepeat: "Repetir la contraseña",
    submit: "Crear mi cuenta",
    creating: "Creando tu financiera…",
    haveAccount: "¿Ya tienes cuenta?",
    goToSignIn: "Entra aquí",
    noAccount: "¿Todavía no tienes cuenta?",
    goToSignUp: "Crea tu financiera",
    errors: {
      emailTaken: "Ya hay una cuenta con ese correo. Entra o usa otro.",
      usernameTaken: "Ese nombre de usuario ya está ocupado. Prueba con otro.",
      invalidUsername:
        "El nombre de usuario debe tener entre 3 y 30 caracteres, sin arroba ni espacios.",
      weakPassword: "La contraseña debe tener al menos 8 caracteres.",
      unknownCountry: "Selecciona el país donde operas.",
      passwordMismatch: "Las dos contraseñas no coinciden.",
    },
  },

  onboarding: {
    title: "Bienvenido a {company}",
    subtitle: "Tres pasos y quedas listo para prestar.",
    stepOf: "Paso {current} de {total}",
    companyStep: "Datos de tu financiera",
    companyStepHint:
      "Salen en los recibos, los contratos y los mensajes al cliente.",
    cashStep: "Tu caja",
    cashStepHint:
      "De aquí sale el dinero que prestas y aquí entra lo que cobras.",
    cashBoxName: "Nombre de la caja",
    openingBalance: "¿Con cuánto dinero empiezas?",
    openingBalanceHint:
      "Lo que tienes disponible ahora para prestar. Puedes dejarlo en cero.",
    readyStep: "Todo listo",
    readyHint:
      "Ya puedes registrar tu primer cliente y darle su préstamo. Las plantillas de cobranza por WhatsApp ya están cargadas.",
    createdFor: "Preparamos esto para ti:",
    createdRoles: "Los roles: dueño, gerente, cobrador y consulta",
    createdTemplates: "Cinco plantillas de mensajes y el recibo de cobro",
    createdAutomations:
      "Cuatro automatizaciones de cobranza, en modo prueba hasta que conectes WhatsApp",
    firstCustomer: "Registrar mi primer cliente",
    skip: "Lo hago después",
    finish: "Terminar",
    done: "Configuración terminada.",
  },

  auth: {
    signIn: "Iniciar sesión",
    signInSubtitle: "Entra con tu cuenta para continuar",
    signOut: "Cerrar sesión",
    email: "Correo electrónico",
    identifier: "Usuario o correo electrónico",
    identifierHint: "Entra con tu nombre de usuario o con tu correo.",
    password: "Contraseña",
    rememberMe: "Mantener sesión iniciada",
    forgotPassword: "¿Olvidaste tu contraseña?",
    invalidCredentials: "Usuario, correo o contraseña incorrectos",
    accountDisabled: "Tu cuenta está desactivada. Contacta al administrador.",
    sessionExpired: "Tu sesión expiró. Vuelve a iniciar sesión.",
    noCompany: "Tu usuario no está asignado a ninguna empresa.",
    signingIn: "Entrando…",
  },

  install: {
    title: "Instalar la aplicación",
    hint: "Queda como una app con su ícono, a pantalla completa y sin la barra del navegador.",
    action: "Instalar ahora",
    alreadyInstalled: "Ya tienes la aplicación instalada en este dispositivo.",
    androidIntro:
      "Tu teléfono puede instalarla ahora mismo. No pesa casi nada y se actualiza sola.",
    androidSteps: [
      "Abre inversiones-jcj.vercel.app en Chrome.",
      "Toca los tres puntos de arriba a la derecha.",
      "Elige «Instalar aplicación» o «Agregar a pantalla de inicio».",
    ],
    manualIntro:
      "En este navegador hay que hacerlo a mano. Desde el teléfono, en Chrome:",
    iosIntro: "En iPhone y iPad se instala desde Safari, en tres pasos:",
    iosSteps: [
      "Abre la página en Safari (no en Chrome).",
      "Toca el botón de compartir, el cuadrito con la flecha hacia arriba.",
      "Baja y elige «Agregar a inicio».",
    ],
    apkTitle: "Aplicación de Android (APK)",
    apkHint:
      "Si prefieres el archivo instalable de Android, se genera desde GitHub. En Releases del repositorio está el archivo .apk listo para descargar.",
  },

  nav: {
    menu: "Menú",
    more: "Más",
    quickActions: "Acciones rápidas",
    profile: "Mi perfil",
    signOut: "Cerrar sesión",
    company: "Empresa",
    branch: "Sucursal",
  },

  modules: {
    dashboard: {
      label: "Inicio",
      description: "Resumen del negocio: cartera, cobros del día y mora.",
    },
    customers: {
      label: "Clientes",
      description: "Ficha del cliente, referencias, documentos e historial.",
    },
    loans: {
      label: "Préstamos",
      description:
        "Créditos con tabla de amortización, contratos y control de mora.",
    },
    payments: {
      // Lo que se abre es el resumen del día, y así lo llama el cobrador
      // tanto en el menú como en la barra de abajo del teléfono.
      label: "Resumen",
      description: "Recibos, abonos y aplicación automática a las cuotas.",
    },
    collections: {
      label: "Rutas de cobro",
      description: "Rutas por cobrador, orden de visitas y resultado del día.",
    },
    promises: {
      label: "Promesas de pago",
      description:
        "Quién prometió pagar, cuándo, y quién cumplió. Lo más barato de cobrar.",
    },
    cash: {
      label: "Caja y bancos",
      description: "Movimientos de efectivo, cuentas y arqueo.",
    },
    expenses: {
      label: "Gastos",
      description: "Gastos por categoría, con o sin préstamo asociado.",
    },
    reports: {
      label: "Reportes",
      description: "Cartera, cobranza, mora, rentabilidad y productividad.",
    },
    templates: {
      label: "Plantillas",
      description:
        "Mensajes y documentos reutilizables con variables del sistema.",
    },
    callCenter: {
      label: "Call center",
      description:
        "Campañas de cobranza, cola de gestión y registro de llamadas.",
    },
    messaging: {
      label: "Mensajería",
      description:
        "WhatsApp automático: recordatorios, avisos de vencimiento y cobranza.",
    },
    moduleBuilder: {
      label: "Constructor de módulos",
      description: "Crea tus propios módulos y campos sin programar nada.",
    },
    settings: {
      label: "Configuración",
      description: "Empresa, sucursales, usuarios, roles y módulos.",
    },
    credit: {
      label: "Central de riesgo",
      description:
        "Consulta por cédula si alguien quedó debiendo en otra oficina, y reporta al que te quedó debiendo a ti.",
    },
  },

  dashboard: {
    title: "Inicio",
    greeting: "Hola, {name}",
    portfolio: "Cartera activa",
    portfolioHint: "Capital colocado pendiente de cobro",
    collectedToday: "Cobrado hoy",
    expectedToday: "Por cobrar hoy",
    overdueAmount: "Monto en mora",
    overdueCustomers: "Clientes en mora",
    activeLoans: "Préstamos activos",
    newCustomers: "Clientes nuevos",
    interestEarned: "Interés generado",
    cashOnHand: "Dinero en caja",
    dueTodayTitle: "Cuotas que vencen hoy",
    arrearsTitle: "Mayor mora",
    recentPaymentsTitle: "Últimos cobros",
    noDueToday: "No hay cuotas que venzan hoy.",
    noArrears: "No hay clientes en mora. Buen trabajo.",
  },

  customers: {
    title: "Clientes",
    singular: "Cliente",
    new: "Nuevo cliente",
    edit: "Editar cliente",
    code: "Código",
    firstName: "Nombres",
    lastName: "Apellidos",
    fullName: "Nombre completo",
    documentType: "Tipo de documento",
    documentNumber: "Número de documento",
    email: "Correo electrónico",
    phone: "Teléfono",
    mobilePhone: "Celular / WhatsApp",
    address: "Dirección de la casa",
    neighborhood: "Barrio / sector",
    city: "Ciudad",
    // La lista de ciudades sale del departamento, así que sin él no hay de
    // dónde sacarla.
    cityNeedsState: "Escoge primero el departamento.",
    state: "Provincia / Estado",
    country: "País",
    location: "Ubicación GPS",
    birthDate: "Fecha de nacimiento",
    birthDateHint: "Va en el contrato. Se calcula la edad sola.",
    age: "Edad",
    ageYears: "{years} años",
    gender: "Sexo",
    genderLabel: {
      FEMALE: "Femenino",
      MALE: "Masculino",
      OTHER: "Otro",
    },
    genderUnset: "Prefiere no decirlo",
    nationality: "Nacionalidad",
    nationalityHint: "Escríbela o elige una de la lista.",
    workSection: "Trabajo",
    employmentType: "¿De qué vive?",
    occupation: "Ocupación / oficio",
    employerName: "Nombre de la empresa",
    workAddress: "Dirección del trabajo",
    workNeighborhood: "Barrio del trabajo",
    monthlyIncome: "Ingreso mensual",
    // El cupo lo fija el dueño; en cero el cliente todavía no tiene.
    creditLimitSection: "Cupo de préstamo",
    creditLimitHint: "Hasta cuánto se le presta a este cliente.",
    creditLimit: "Cupo",
    creditLimitFieldHint:
      "En cero significa que todavía no tiene cupo asignado.",
    creditLimitNone: "Sin cupo asignado",
    employmentTypeLabel: {
      INDEPENDENT: "Independiente / negocio propio",
      EMPLOYEE: "Empleado de una empresa",
      OTHER: "Otro",
    },
    creditScore: "Score de crédito",
    references: "Referencias",
    reference: "Referencia",
    relationship: "Parentesco / relación",
    documents: "Documentos",
    history: "Historial",
    loansTab: "Préstamos",
    interactionsTab: "Gestiones",
    status: {
      ACTIVE: "Activo",
      INACTIVE: "Oculto",
      BLACKLISTED: "Lista negra",
    },
    personalSection: "Datos personales",
    mainSection: "Datos principales",
    mainSectionHint:
      "Lo mínimo para registrarlo. El resto se puede llenar después.",
    generalSection: "Datos generales",
    generalSectionHint: "Fecha de nacimiento, sexo y nacionalidad.",
    contactSection: "Contacto",
    contactSectionHint: "Teléfono fijo y correo electrónico.",
    // Nombra los campos en el orden en que están, que es el orden en que se
    // dicta una dirección: de lo ancho a lo estrecho.
    homeSectionHint:
      "Departamento, ciudad, barrio, dirección, punto de referencia y ubicación.",
    workSectionHint:
      "De qué vive, dónde trabaja, con qué vehículo y cuánto gana.",
    notesHint: "Cualquier cosa que quieras recordar de este cliente.",
    homeSection: "Dónde vive",
    landmark: "Punto de referencia",
    landmarkHint: "Ej.: frente al colmado Mi Ranchito, casa amarilla.",
    workLandmark: "Punto de referencia del trabajo",
    locationHome: "Ubicación de la casa",
    locationWork: "Ubicación del trabajo",
    captureLocation: "Guardar mi ubicación",
    recaptureLocation: "Actualizar ubicación",
    locationSaved: "Ubicación guardada",
    locationSaving: "Buscando ubicación…",
    locationDenied:
      "No se pudo obtener la ubicación. Revisa los permisos del navegador.",
    locationUnsupported: "Este dispositivo no permite obtener la ubicación.",
    openInMaps: "Ver en el mapa",

    // La ficha del cliente, por partes: buscar el barrio en una lista de
    // quince renglones seguidos no se puede parado en la calle.
    identitySection: "Identidad",
    statsSection: "Estadísticas",
    loansTotal: "Total de préstamos",
    loansOpen: "Préstamos activos",
    loansActive: "Préstamos activos",
    loansHistory: "Historial de préstamos",
    loansInProgress: "En curso",
    loansClosed: "Préstamos terminados",
    loansClosedHint:
      "Saldados o dados por perdidos. Se quedan aquí: cuántas veces ha vuelto un cliente y cómo pagó también es su historia.",
    paymentsCount: "Abonos registrados",
    paidTotal: "Total abonado",
    paymentsTruncated:
      "Se muestran los {shown} más recientes de {total}. Los demás están en cada préstamo.",
    interactionsHint:
      "Llamadas, visitas y mensajes que se le han hecho a este cliente.",
    idDocuments: "Documento de identidad",
    otherDocuments: "Otros documentos",
    lentTotal: "Capital prestado",
    lentTotalHint: "Todo lo que se le ha entregado",
    registrySection: "Registro",
    customerSince: "Cliente desde",
    createdBy: "Registrado por",
    updatedAtLabel: "Última actualización",
    collectorInCharge: "Encargado de cobro",
    noCollector: "Sin cobrador",
    unknownUser: "No quedó registrado",
    callCustomer: "Llamar",
    whatsappCustomer: "WhatsApp",
    // En el menú de los tres puntos, donde no cabe el título largo.
    seeAttachments: "Ver adjuntos",
    newLoanForCustomer: "Crear préstamo",
    // Los atajos de arriba: la ficha es larga y en el teléfono llegar a los
    // abonos eran cuatro deslizadas.
    jumpLoans: "Préstamos",
    jumpPayments: "Abonos",
    jumpReferences: "Referencias",
    jumpDocuments: "Documentos",
    jumpInteractions: "Gestiones",

    paydaySection: "Día de pago",
    paydayHint:
      "Sirve para proponer la fecha de la primera cuota justo después de que cobra.",
    paydayKind: "¿Cada cuánto le pagan?",
    paydayWeekday: "¿Qué día de la semana?",
    paydayDayOfMonth: "¿Qué día del mes?",
    paydayKindLabel: {
      DAILY: "Todos los días",
      WEEKLY: "Semanal",
      BIWEEKLY: "Cada dos semanas",
      SEMIMONTHLY: "Quincenal (15 y fin de mes)",
      MONTHLY: "Mensual",
      IRREGULAR: "Sin fecha fija",
    },
    referencesSection: "Referencias",
    referencesHint:
      "Personas que responden por el cliente. Son lo que queda cuando no lo encuentras.",
    referenceName: "Nombre completo",
    referenceRelationship: "Parentesco o relación",
    referencePhone: "Teléfono",
    referenceAddress: "Dirección",
    addReference: "Agregar otra referencia",
    noReferences: "Todavía no hay referencias",
    photo: "Foto del cliente",
    photoHint: "Obligatoria. Tómala de frente y con buena luz.",
    photoRequired: "La foto del cliente es obligatoria.",
    documentRequired: "El número de documento es obligatorio.",
    mobileRequired:
      "El celular es obligatorio: por ahí se le cobra al cliente.",
    mobilePhoneHint: "Obligatorio. Por ahí se le manda el cobro por WhatsApp.",
    documentTaken:
      "Ya hay un cliente registrado con ese número de documento. Búscalo en la lista en vez de crearlo de nuevo.",
    vehiclePlate: "Placa del vehículo",
    vehiclePlateHint:
      "Si trabaja con taxi, moto o carro. Sirve para ubicarlo cuando no está en la casa.",
    delete: "Eliminar cliente",
    deleteConfirm:
      "Se borra el cliente con todo lo suyo y no se puede deshacer.",
    deleteWithLoans:
      "Se borran también sus {loans} préstamos, con sus cuotas y sus cobros. La plata vuelve a la caja como si nunca se le hubiera prestado.",
    deleteOutstanding: "Deja de deber {amount}",
    deletePaid: "Se pierde el historial de {amount} ya cobrados",
    deleteNoLoans: "Este cliente no tiene préstamos.",
    loanCount: "Préstamos",
    // Ocultar es para el cliente que lleva meses sin pedir nada: deja de
    // estorbar en la lista sin perder su historia. No es borrarlo ni ponerlo
    // en lista negra, que son otras dos cosas.
    hide: "Ocultar cliente",
    hideConfirm:
      "Deja de salir en la lista de clientes. Su historia y sus préstamos quedan como están, y se puede volver a mostrar cuando quieras.",
    hidden: "Este cliente está oculto.",
    hiddenHint:
      "No sale en la lista. Todo lo suyo sigue guardado; vuelve a mostrarlo cuando pida otro préstamo.",
    unhide: "Mostrar de nuevo",
    hideDone: "El cliente quedó oculto.",
    unhideDone: "El cliente vuelve a salir en la lista.",
    hideBlocked:
      "No se puede ocultar a alguien que todavía debe: tiene {count} préstamos abiertos. Primero salda o anula lo que tenga afuera.",
    hideBlockedOne:
      "No se puede ocultar a alguien que todavía debe: tiene un préstamo abierto. Primero salda o anula lo que tenga afuera.",
    // El filtro de la lista.
    showing: "Mostrando",
    onlyVisible: "Sin los ocultos",
    onlyHidden: "Solo los ocultos",
    allCustomers: "Todos",
    hiddenCount: "{count} ocultos",
    hiddenCountOne: "1 oculto",
    statActive: "Con préstamo",
    statIdle: "Sin préstamo",
    statContact: "Con contacto",
    noOpenLoans: "Sin préstamos abiertos",
    documentsSection: "Fotos del documento de identidad",
    documentsHint:
      "Fotografía el documento por ambos lados, que se lea el número.",
    idFront: "Documento (frente)",
    idBack: "Documento (reverso)",
    noPhoto: "Sin foto",
    saved: "Los cambios quedaron guardados.",
    emptyTitle: "Todavía no hay clientes",
    emptyHint: "Registra tu primer cliente para poder crear préstamos.",
    blacklistWarning:
      "Este cliente está en lista negra. Revisa antes de aprobar un crédito.",
    arrearsWarning:
      "Este cliente tiene {count} cuotas atrasadas en sus préstamos abiertos.",
    arrearsWarningOne:
      "Este cliente tiene 1 cuota atrasada en un préstamo abierto.",
    errors: {
      birthDate: "Revisa la fecha de nacimiento: no puede ser futura.",
    },
  },

  loans: {
    title: "Préstamos",
    singular: "Préstamo",
    new: "Nuevo préstamo",
    edit: "Editar préstamo",
    code: "Número de préstamo",
    customer: "Cliente",
    product: "Tipo de préstamo",
    principal: "Monto prestado",
    // --- Comprobante del préstamo ---
    documentTitle: "Comprobante de préstamo",
    documentHint:
      "El papel que firma y se lleva el cliente, con todas las cuotas.",
    downloadPdf: "Descargar el PDF",
    sharePdf: "Enviar por WhatsApp",
    documentPage: "Página {current} de {total}",
    documentFooter:
      "Este documento detalla las condiciones acordadas y el plan de cuotas.",
    signCustomer: "Firma del cliente",
    signCompany: "Por la empresa",
    columnNumber: "N.º",
    columnBalance: "Saldo",
    principalShare: "Capital",
    interestShare: "Interés",

    interestRate: "Tasa de interés (%)",
    interestRateHint: "El porcentaje que le cobras al cliente.",
    rateBasis: "¿El interés es sobre qué?",
    rateBasisLabel: {
      TOTAL: "Sobre el préstamo completo",
      PER_PERIOD: "Por cada cuota",
    },
    rateBasisShort: {
      TOTAL: "del préstamo",
      PER_PERIOD: "por cuota",
    },
    rateBasisHint: {
      TOTAL:
        "100.000 al 20% son 20.000 de interés, se cobren en 30 días o en 6 meses.",
      PER_PERIOD:
        "Cada cuota cobra ese porcentaje. Es lo que se quiere decir con «5% mensual» a 12 meses.",
    },
    interestMethod: "Modalidad de interés",
    frequency: "Frecuencia de pago",
    termCount: "Cantidad de cuotas",
    firstDueDate: "Fecha de la primera cuota",
    // El día que se entrega la plata no se cobra: la primera cuota va un
    // período después, y se mueve sola al cambiar la frecuencia.
    startDate: "Fecha de inicio",
    startDateHint:
      "El día que entregas la plata. No se cobra ese día: la primera cuota cae el {date}.",
    startDateHintEmpty: "El día que entregas la plata.",
    disbursedAt: "Fecha de desembolso",
    lateFee: "Mora",
    lateFeeMode: "Cálculo de la mora",
    lateFeeValue: "Valor de la mora",
    gracePeriodDays: "Días de gracia",
    schedule: "Tabla de amortización",
    schedulePreview: "Vista previa de las cuotas",
    installment: "Cuota",
    installments: "Cuotas",
    dueDate: "Vencimiento",
    principalPart: "Capital",
    interestPart: "Interés",
    lateFeePart: "Mora",
    installmentTotal: "Total cuota",
    balanceAfter: "Saldo",
    paidAmount: "Pagado",
    totalInterest: "Interés total",
    totalToPay: "Total a pagar",
    outstanding: "Saldo pendiente",
    daysInArrears: "Días de mora",
    disburse: "Desembolsar",
    approve: "Aprobar",
    contract: "Contrato",
    openEndedNotice:
      "Este es un préstamo indefinido: solo se programa el interés y el capital queda pendiente hasta que el cliente lo salde.",
    method: {
      FLAT: "Porcentaje simple (fijo sobre el capital)",
      FRENCH: "Francés (cuota fija)",
      GERMAN: "Alemán (capital fijo)",
      AMERICAN: "Americano (solo interés, capital al final)",
      CREDIT_LINE: "Línea de crédito (indefinido)",
    },
    frequencyLabel: {
      DAILY: "Diario",
      EVERY_OTHER_DAY: "Un día sí y uno no",
      TWICE_WEEKLY: "Dos veces a la semana",
      WEEKLY: "Semanal",
      BIWEEKLY: "Cada 14 días",
      SEMIMONTHLY: "Quincenal",
      MONTHLY: "Mensual",
      QUARTERLY: "Trimestral",
      YEARLY: "Anual",
      SINGLE: "Pago único",
      CUSTOM: "Personalizado",
    },
    suggestedFirstDueDate: "Sugerida por el día de pago del cliente: {date}",
    useSuggestedDate: "Usar esa fecha",
    customIntervalDays: "Cobrar cada cuántos días",
    customIntervalHint: "Por ejemplo, 10 para cobrar cada 10 días.",
    nonCollectionDays: "Días que no se cobra",
    nonCollectionHint:
      "Marca los días en que no sales a cobrar. Las cuotas se corren al siguiente día hábil.",
    nonCollectionNone: "Se cobra todos los días",
    weekday: {
      "0": "Domingo",
      "1": "Lunes",
      "2": "Martes",
      "3": "Miércoles",
      "4": "Jueves",
      "5": "Viernes",
      "6": "Sábado",
    },
    weekdayShort: {
      "0": "Dom",
      "1": "Lun",
      "2": "Mar",
      "3": "Mié",
      "4": "Jue",
      "5": "Vie",
      "6": "Sáb",
    },
    lateFeeModeLabel: {
      NONE: "Sin mora",
      PERCENT_OF_INSTALLMENT: "% de la cuota, una sola vez",
      PERCENT_PER_DAY: "% de la cuota por cada día de atraso",
      FIXED_PER_DAY: "Monto fijo por cada día de atraso",
      FIXED_ONCE: "Monto fijo, una sola vez",
    },
    status: {
      DRAFT: "Borrador",
      PENDING_APPROVAL: "Por aprobar",
      APPROVED: "Aprobado",
      ACTIVE: "Activo",
      IN_ARREARS: "En mora",
      PAID: "Saldado",
      WRITTEN_OFF: "Incobrable",
    },
    installmentStatus: {
      PENDING: "Pendiente",
      PARTIALLY_PAID: "Abonada",
      PAID: "Pagada",
      OVERDUE: "Vencida",
      WAIVED: "Condonada",
    },
    editLockedPaid:
      "Este préstamo ya está saldado: sus condiciones son historia y no se cambian.",
    editTermsWarning:
      "Si cambias el monto, la tasa o las cuotas, el plan se vuelve a calcular y los cobros ya registrados se aplican otra vez sobre el plan nuevo.",
    delete: "Eliminar préstamo",
    deleteConfirm:
      "Se borra el préstamo con sus cuotas y sus cobros, y la plata vuelve a la caja como si nunca se hubiera prestado. Esto no se puede deshacer.",
    deleted: "Préstamo eliminado.",
    editLockedClosed: "Este préstamo está cerrado y no se puede modificar.",
    emptyTitle: "Todavía no hay préstamos",
    emptyHint: "Crea el primer préstamo para empezar a cobrar.",
    errors: {
      principal: "El monto prestado debe ser mayor que cero.",
      interestRate:
        "La tasa no es válida: la cuota no alcanza a cubrir el interés.",
      termCount: "La cantidad de cuotas debe ser un número entero positivo.",
      guarantorNotFound: "Ese fiador no está registrado en esta oficina.",
      guarantorIsBorrower:
        "El fiador tiene que ser otra persona, no el mismo cliente del préstamo.",
      customIntervalDays:
        "Indica cada cuántos días se cobra (un número entero mayor que cero).",
      nonCollectionDays:
        "Tiene que quedar al menos un día de la semana para cobrar.",
      firstDueDate: "La fecha de la primera cuota no es válida.",
      customerRequired: "Debes seleccionar un cliente.",
      notFound: "No se encontró el préstamo.",
      closed: "Este préstamo está cerrado y no se puede modificar.",
      termsLocked:
        "Este préstamo está saldado: solo se pueden cambiar las notas.",
      noBalance:
        "Este préstamo no debe nada. Si el cliente quiere plata otra vez, hazle un préstamo nuevo.",
      notNewMoney:
        "Para renovar, el monto nuevo tiene que ser mayor que el saldo. Si es igual al saldo, lo que estás haciendo es una refinanciación.",
      notRenewable:
        "Solo se refinancian o renuevan préstamos que estén activos o en mora.",
      alreadyRenewed:
        "Este préstamo ya fue refinanciado o renovado con otro préstamo.",
      name: "A cada cargo adicional ponle un nombre.",
      overPrincipal:
        "Los cargos que le descuentas se llevarían todo lo que le vas a entregar. Bájalos o cóbralos en las cuotas.",
    },
    // --- Cargos adicionales ---
    charges: {
      title: "Cargos adicionales",
      hint: "Lo que le cobras aparte del interés: papelería, estudio, renovación. Le pones el nombre que quieras.",
      add: "Agregar un cargo",
      remove: "Quitar",
      name: "Nombre del cargo",
      namePlaceholder: "Papelería",
      amount: "Valor",
      mode: "¿Cómo lo cobras?",
      modeLabel: {
        DEDUCTED: "Se lo descuento al entregar",
        FINANCED: "Se lo sumo a las cuotas",
        PENDING: "Se lo cobro aparte",
      },
      saved: "Cargos guardados.",
      empty2: "Este préstamo no tiene cargos adicionales.",
      removeConfirm:
        "Al quitarlo se rehacen las cuotas y la caja se mueve por lo que se le había descontado al cliente.",
      // Cambiar un cargo mueve las cuotas y la caja: hay que decirlo antes,
      // no después.
      editHint:
        "Al guardar se rehacen las cuotas, se vuelve a aplicar lo cobrado y la caja se mueve por la diferencia.",
      // Con la plata ya entregada no hay cómo descontarle nada al cliente: la
      // tiene en el bolsillo. Un cargo puesto después queda debiéndose.
      modeFixed: "no se cambia con el préstamo ya entregado",
      editHintDisbursed:
        "El préstamo ya se entregó, así que el cargo queda por cobrar y las cuotas no se tocan. Se lo cobras desde «Registrar cobro».",
      modeHint: {
        DEDUCTED:
          "Si prestas 100.000 y el cargo es 5.000, le entregas 95.000. Debe los 120.000 de siempre y el cargo ya quedó cobrado.",
        FINANCED:
          "Le entregas los 100.000 completos y el cargo se reparte entre las cuotas: debe 125.000 en vez de 120.000.",
        PENDING:
          "Le entregas los 100.000 completos y el cargo queda anotado. Se lo cobras cuando puedas desde «Registrar cobro», y ahí entra a la caja.",
      },
      empty: "Sin cargos adicionales.",
      handedOver: "Le entregas en efectivo",
      handedOverHint: "El monto prestado menos los cargos que le descuentas.",
      deductedTotal: "Cargos descontados",
      financedTotal: "Cargos en las cuotas",
      pendingTotal: "Cargos por cobrar",
      // Lo que le falta a un cargo que se está cobrando por partes.
      pendingLeft: "Falta {amount}",
      // «Cargo» a secas se confundía con «Cargos al entregar» de la tarjeta de
      // al lado, que es otra plata: este es el pedazo de cargo que venía
      // dentro de la cuota que el cliente acaba de pagar.
      installmentPart: "Cargo de la cuota",
      collected: "Cargos cobrados",
    },
    // --- Contactar al cliente desde el préstamo ---
    contact: {
      call: "Llamar",
      whatsapp: "Escribir por WhatsApp",
      sms: "Mensaje de texto",
      noPhone: "Este cliente no tiene celular guardado.",
    },
    // --- Lista de préstamos ---
    lent: "Prestado",
    collected: "Cobrado",
    toCollect: "Por cobrar",
    recovered: "{percent}% recuperado",
    collectNow: "Cobrar hoy",
    nextInstallment: "Próxima cuota",
    nothingDue: "Nada por cobrar",
    lastPayment: "Últ. pago",
    noPayments: "Sin pagos",
    // Lo que se atrasa son cuotas; lo que se vence es el crédito. Son dos
    // cosas distintas y llamarlas igual confunde: un cliente puede llevar
    // veinte cuotas atrasadas sin que el crédito se haya vencido, y el
    // crédito puede haberse vencido ayer y llevar un solo día vencido.
    overdueInstallments: "Cuotas atrasadas",
    overdueCountShort: "{count} atrasadas",
    overdueCountShortOne: "1 atrasada",
    overdueCountLong: "{count} cuotas atrasadas",
    overdueCountLongOne: "1 cuota atrasada",
    noneOverdue: "Ninguna atrasada",
    expiredDays: "Vencido hace {days} días",
    expiredDaysOne: "Vencido hace 1 día",
    expiredShort: "Vencido {days} d",
    expiresOn: "Se vence el {date}",
    oldestOverdue: "La más vieja, del {date}",
    upToDate: "Al día",
    // Para pasar de un préstamo a otro sin devolverse a la lista, que es lo
    // que uno hace bajando una ruta.
    previousLoan: "Préstamo anterior",
    nextLoan: "Préstamo siguiente",
    // En el botón va la palabra corta, que en un teléfono angosto la larga
    // no cabe; la larga queda para quien lo lee en voz alta.
    previousShort: "Anterior",
    nextShort: "Siguiente",
    // Lo que el cliente tendría que pagar hoy para quedar al corriente, y de
    // cuántas cuotas y cada cuánto es el crédito.
    toCatchUp: "Para ponerse al día",
    lateFeeOwed: "Mora acumulada",
    // El avance del préstamo contado como lo cuenta el cliente: cuántas
    // cuotas lleva, cuántas le faltan y cuánta plata ya entregó.
    installmentsPaid: "Cuotas pagadas",
    installmentsLeft: "Le faltan",
    paidSoFar: "Ya ha pagado",
    paidPercent: "{percent}% pagado",
    // De cuándo a cuándo va el crédito, que es lo que el cliente pregunta
    // cuando quiere saber cuánto le falta para quedar libre.
    guarantor: "Fiador",
    guarantorHint:
      "Quién responde si el cliente no paga. Se escoge entre los clientes registrados.",
    noGuarantor: "Sin fiador",
    guarantorOf: "Fiador de este préstamo",
    startLabel: "Inicio",
    endLabel: "Vence",
    endedLabel: "Terminó",
    firstDueShort: "1ª cuota",
    shiftFirstDueNotice:
      "Este préstamo cobra la primera cuota el mismo día en que se entregó la plata ({first}), y por eso se acaba el {end} en vez del {proposedEnd}. Es de antes de la regla de no cobrar el día de la entrega.",
    shiftFirstDueAction: "Correr la primera cuota al {to}",
    fixAllNotice:
      "Hay {count} préstamos que cobran la primera cuota el mismo día en que se entregó la plata, y por eso se acaban un período antes de lo que deberían. Son de antes de la regla de no cobrar el día de la entrega.",
    fixAllMore: "y {rest} más",
    fixAllAction: "Corregir los {count} de una vez",
    fixAllConfirm:
      "Se corre la primera cuota de {count} préstamos al día siguiente de la entrega, y con ella todas las demás cuotas.\n\nLo que cada cliente ya haya abonado se vuelve a repartir sobre su plan nuevo, y desde cuándo está atrasado cambia. Solo se tocan los préstamos vivos: los saldados y los anulados se quedan como están.",
    shiftFirstDueConfirm:
      "La primera cuota pasa del {from} al {to}, y el préstamo se acaba el {endTo} en vez del {endFrom}.\n\nTodas las cuotas se corren un período. Lo que el cliente ya haya abonado se vuelve a repartir sobre el plan nuevo, y desde cuándo está atrasado cambia.",
    installmentsOf: "{count} cuotas ({frequency})",
    nextDueOn: "Próxima cuota el {date}",
    installmentLate: "hace {days} d",
    installmentLateOne: "hace 1 d",
    onTime: "Al día",
    filterAll: "Todos",
    filterOnTime: "Al día",
    filterLate: "Atrasados",
    filterExpired: "Vencidos",
    filterPaid: "Saldados",
    saved: "Préstamo actualizado.",

    // --- Refinanciación y renovación ---
    renewal: {
      action: "Refinanciar o renovar",
      titleOf: {
        REFINANCE: "Refinanciar el préstamo {code}",
        RENEWAL: "Renovar el préstamo {code}",
      },
      subtitle:
        "El saldo que queda se pasa a un préstamo nuevo. El préstamo viejo queda saldado.",
      kindLabel: {
        REFINANCE: "Refinanciar",
        RENEWAL: "Renovar",
      },
      kindMenu: {
        REFINANCE: "Refinanciación",
        RENEWAL: "Renovación",
      },
      kindHint: {
        REFINANCE:
          "El cliente no tiene con qué pagar el saldo. Ese saldo pasa a ser el monto del préstamo nuevo y se le cobra interés encima. No entregas ni recibes plata.",
        RENEWAL:
          "El cliente quiere que le vuelvas a prestar. Le descuentas lo que debía y le entregas la diferencia en efectivo.",
      },
      settled: "Saldo que se pasa al préstamo nuevo",
      newPrincipal: "Monto del préstamo nuevo",
      newPrincipalHint:
        "Lo que le vas a prestar en total. Tiene que ser mayor que el saldo que debe.",
      cashOut: "Le entregas en efectivo",
      cashOutNone: "No entregas plata: solo se pasa el saldo.",
      cashOutHint: "Monto nuevo menos el saldo que debía.",
      summaryTitle: "Cómo queda la cuenta",
      confirmRefinance: "Refinanciar",
      confirmRenewal: "Renovar y entregar",
      settledWith: "Cancelado con el préstamo",
      // Se ven en la ficha del préstamo, uniendo el viejo con el nuevo.
      originLabel: {
        NEW: "Préstamo nuevo",
        REFINANCE: "Refinanciación",
        RENEWAL: "Renovación",
      },
      comesFrom: "Viene del préstamo {code}",
      replacedBy: "Refinanciado con el préstamo {code}",
      done: "Listo: préstamo {code} creado.",
    },
  },

  payments: {
    title: "Cobros",
    singular: "Cobro",
    // En el préstamo la lista no son "los cobros" en general: son los abonos
    // que ese cliente ha hecho, y así los llama él.
    historyTitle: "Historial de abonos",
    new: "Registrar cobro",
    receiptNumber: "Número de recibo",
    receipt: "Recibo",
    amount: "Monto recibido",
    method: "Forma de pago",
    paidAt: "Fecha del cobro",
    reference: "Referencia",
    cashBox: "Caja / cuenta destino",
    collectedBy: "Cobrado por",
    // De dónde sale el valor que aparece solo en el campo, para que nadie
    // tenga que adivinarlo ni recalcularlo.
    amountIsInstallment: "Es la cuota: {amount}",
    amountOverdue: "Vencido hasta hoy: {amount} en {count} cuotas",
    amountOverdueOne: "Vencido hasta hoy: {amount} en 1 cuota",
    amountRest: "Es lo que falta para saldar: {amount}",
    // El historial: a dónde fue cada peso y quién lo recibió.
    appliedTitle: "A dónde ha ido lo pagado",
    collectedByShort: "por {name}",
    showingLast: "Mostrando los últimos {shown} de {total} cobros.",
    // El historial se abre solo cuando hace falta: en la puerta se miran los
    // últimos, no los de hace tres meses.
    showAll: "Ver historial completo ({count} más)",
    showLess: "Ver solo los últimos",

    // --- El resumen del día, que es la cuenta que se entrega en la noche ---
    summary: {
      handOver: "Total a entregar",
      handOverHint:
        "Lo cobrado y los cargos, menos lo prestado y los gastos del día.",
      counts: "{payments} abonos · {loans} préstamos",
      countsPaymentOne: "1 abono",
      countsLoanOne: "1 préstamo",
      income: "De dónde salió lo cobrado",
      collected: "Total cobrado",
      methods: "Cómo lo pagaron",
      movement: "Movimiento del día",
      lent: "Prestado",
      expenses: "Gastos",
      refinanced: "Refinanciaciones",
      renewed: "Renovaciones",
      carried: "{count} · saldo trasladado",
      handedOut: "{count} · entregado",
      newLoans: "Préstamos nuevos",
      // Los cuatro cuadros de arriba: lo que se movió hoy, cada cosa por su
      // nombre y con cuántas fueron.
      tileLoans: "Préstamos",
      countLoans: "{count} préstamos",
      countLoansOne: "1 préstamo",
      countRenewals: "{count} renovaciones",
      countRenewalsOne: "1 renovación",
      countRefinances: "{count} refinanciaciones",
      countRefinancesOne: "1 refinanciación",
      countExpenses: "{count} gastos",
      countExpensesOne: "1 gasto",
      // Los cargos no son un préstamo ni un gasto: es lo que el negocio se
      // gana aparte del interés, y hasta ahora había que buscarlo adentro.
      tileCharges: "Cargos adicionales",
      countCharges: "{count} cargos",
      countChargesOne: "1 cargo",
      // Lo cobrado es el número grande del día: va arriba de todo y de lado a
      // lado, porque es de donde sale todo lo demás.
      countPayments: "{count} abonos",
      countPaymentsOne: "1 abono",
      none: "Ninguno",
      // La pantalla que se abre al tocar un cuadro.
      detailLoans: "Préstamos",
      detailRenewals: "Renovaciones",
      detailRefinances: "Refinanciaciones",
      detailExpenses: "Gastos",
      detailCharges: "Cargos adicionales",
      detailCollected: "Lo cobrado del día",
      collectedHint:
        "Cada abono del día: quién pagó, cuánto entró y cuánto le queda debiendo.",
      collectedNoBalance: "Queda al día",
      // De dónde salió cada cargo: uno se le descontó al entregarle la plata,
      // el otro se le cobró aparte de la cuota, en la puerta.
      chargeDeducted: "Descontado al entregar",
      chargeApart: "Cobrado aparte",
      chargesHint:
        "Lo que dejaron los cargos ese día: los que se descontaron al entregar la plata y los que se cobraron aparte. El cargo repartido en las cuotas llega dentro del abono y se ve en lo cobrado.",
      detailEmpty: "No hay nada de esto registrado ese día.",
      // El resumen en papel, para mandárselo al dueño al cerrar el día.
      pdfTitle: "Resumen del día",
      pdfShare: "Enviar por WhatsApp",
      pdfDownload: "Descargar el PDF",
      pdfMessage: "Resumen del {day} · {company}",
      pdfFooter:
        "Generado por la aplicación. Las cifras son las del día que dice arriba.",
      pdfNoPayments: "Ese día no se registró ningún abono.",
      // El aviso del recibo habla de una imagen; aquí es un PDF, y decirle
      // "descarga la imagen" a quien acaba de bajar un PDF lo manda a buscar
      // un archivo que no existe.
      pdfFallback:
        "Tu navegador no puede compartir archivos. Ya se descargó el PDF: adjúntalo en el chat.",
      detailTotal: "Total del día",
      back: "Volver al resumen",
      // El día que se está viendo, que no siempre es hoy.
      title: "Resumen",
      day: "Día",
      dayToday: "Hoy",
      dayYesterday: "Ayer",
      show: "Ver",
      loansOfDay: "Préstamos del día",
      capital: "Capital",
      rate: "% Interés",
      mode: "Modalidad",
      term: "Plazo",
      termOf: "{count} cuotas",
      startsOn: "Fecha inicio",
      lateFeePerInstallment: "Mora por cuota",
      graceHint: "Aplica mora después de {days} días",
      expenseCategory: "Sin categoría",
      kindNew: "Nuevo",
      amountLent: "prestado",
      amountHandedOut: "entregado",
      amountCarried: "trasladado",
      // El cargo descontado al entregar: entró a la caja el mismo día.
      chargesTaken: "Cargos al entregar",
      chargesApartLine: "Cargos cobrados aparte",
      profit: "Ganancia del día",
      profitHint: "Interés, mora y cargos cobrados, menos los gastos.",
      // Las tres tarjetas de abajo miran cosas distintas, y con nombres
      // parecidos se confunden: cada una dice de entrada qué está mirando.
      incomeHint:
        "Cómo se repartió lo que entró por abonos. Los cargos que se descuentan al entregar no entran aquí: esos van en el movimiento del día.",
      incomeNone: "Hoy no ha entrado ningún abono.",
      incomeNoneThatDay: "Ese día no entró ningún abono.",
      movementHint: "Lo que salió y lo que entró por fuera de los abonos.",
      methodsHint: "De qué manera entró lo que se cobró.",
      nothing: "Todavía no hay movimiento hoy.",
      // Mirando otro día, "hoy" sería mentira: ese día ya pasó.
      nothingThatDay: "Ese día no hubo movimiento.",
    },
    // El contador de cuotas al lado del monto: dos toques en vez de teclear.
    installmentCount: "cuotas",
    installmentCountOne: "cuota",
    oneMore: "Una cuota más",
    oneLess: "Una cuota menos",
    customAmount: "Monto libre",
    collectAmount: "Cobrar {amount}",
    allocation: "Aplicación del pago",
    allocationHint:
      "El pago se aplica a la cuota más antigua: primero mora, luego el cargo adicional, después el interés y por último el capital.",
    unapplied: "Sobrante a favor",
    // --- Comprobante ---
    receiptTitle: "Comprobante de abono",
    receiptVoided: "Comprobante anulado",
    receiptApplied: "Abonado a capital e interés",
    receiptLate: "Atrasado {days} días",
    receiptInstallments: "Cuotas pagadas",
    receiptNextDue: "Próxima cuota",
    receiptLastDue: "Fecha de vencimiento",
    receiptFooter: "¡De la puntualidad depende su siguiente préstamo!",
    receiptKeep: "*** Conserve este comprobante ***",
    receiptOf: "Comprobante de {receipt}",
    share: "Compartir por WhatsApp",
    sharing: "Preparando…",
    shareFallback:
      "Tu navegador no puede compartir archivos. Descarga la imagen y adjúntala en WhatsApp.",
    download: "Descargar imagen",
    history: "Historial de pagos",
    historyHint: "Todo lo que ha abonado este cliente, en todos sus préstamos.",
    collectedByLabel: "Recibido por",
    delete: "Eliminar el cobro",
    deleteConfirm:
      "Se borra el recibo y el dinero vuelve a las cuotas y a la caja. No queda a la vista, solo en la auditoría. Para dejar constancia, mejor anúlalo.",
    deleted: "Cobro eliminado.",

    reverse: "Anular cobro",
    reverseConfirm:
      "Se devuelve el monto a las cuotas y se descuenta de la caja. El recibo queda marcado como anulado.",
    reversed2: "Cobro anulado.",
    reverseReason: "Motivo de la anulación",
    edit: "Editar cobro",
    editHint:
      "Se vuelve a aplicar sobre las cuotas y la caja se mueve solo por la diferencia. El recibo sigue siendo el mismo.",
    updated: "Cobro actualizado.",
    reversed: "Anulado",
    // Qué se está cobrando: la cuota del préstamo, o un cargo que se le cobra
    // al cliente aparte y que no baja lo que debe.
    conceptLabel: {
      INSTALLMENT: "Cuota del préstamo",
      LATE_FEE: "Mora",
      CHARGE: "Cargo adicional",
    },
    conceptHint: {
      INSTALLMENT:
        "Se reparte entre lo vencido: primero la mora, después el cargo, el interés y por último el capital.",
      LATE_FEE:
        "Solo se cobra lo que se le sumó por atrasarse. La cuota sigue debiendo lo suyo.",
      CHARGE:
        "Entra a la caja como cargo cobrado. No baja lo que el cliente debe ni toca las cuotas.",
    },
    // El cargo no se escribe: se escoge de los que el préstamo dejó anotados.
    // Escrito a mano, «Papeleria» y «Papelería» eran dos cargos distintos y el
    // del préstamo seguía debiéndose después de haberlo cobrado.
    chargePick: "¿Cuál cargo le cobras?",
    chargePickHint:
      "Solo los que este préstamo tiene por cobrar. Se pueden abonar por partes.",
    chargeNone:
      "Este préstamo no tiene cargos por cobrar. Para cobrarle uno, agrégalo primero en los cargos del préstamo como «Se lo cobro aparte».",
    chargeOption: "{name} · falta {amount}",
    chargeCollected: "Cargo cobrado: {name}",
    collectCharge: "Cobrar {amount} de cargo",
    methodLabel: {
      CASH: "Efectivo",
      BANK_TRANSFER: "Transferencia",
      CARD: "Tarjeta",
      CHECK: "Cheque",
      MOBILE_WALLET: "Billetera móvil",
      REFINANCE: "Refinanciación",
      OTHER: "Otro",
    },
    statusLabel: {
      POSTED: "Aplicado",
      REVERSED: "Anulado",
    },
    emptyTitle: "Todavía no hay cobros",
    emptyHint: "Los recibos que registres aparecerán aquí.",
    errors: {
      amountPositive: "El monto debe ser mayor que cero.",
      loanNotActive: "El préstamo no está activo.",
      settlesRefinance:
        "Este cobro es el saldo que se pasó a otro préstamo, no plata que entró. Para deshacerlo, anula el préstamo con el que se refinanció.",
      nothingToApply: "Este préstamo no tiene cuotas pendientes.",
      noLateFee: "Este préstamo no tiene mora por cobrar.",
      reversed: "Este cobro está anulado. Elimínalo y registra uno nuevo.",
      chargeNotPending:
        "Ese cargo ya no está por cobrar. Escoge uno de los que el préstamo tiene pendientes.",
      chargeTooMuch:
        "Estás cobrando más de lo que falta del cargo. Ajusta el monto a lo que queda.",
      chargeCashBox:
        "Escoge la caja donde entra la plata del cargo. Sin caja no hay dónde meterla.",
    },
  },

  collections: {
    title: "Rutas de cobro",
    singular: "Ruta",
    new: "Nueva ruta",
    routeName: "Nombre de la ruta",
    scheduledFor: "Programada para",
    collector: "Cobrador",
    stops: "Visitas",
    stop: "Visita",
    order: "Orden",
    expectedAmount: "Esperado",
    collectedAmount: "Cobrado",
    visitedAt: "Visitado",
    promisedFor: "Promesa de pago",
    optimize: "Ordenar por cercanía",
    startRoute: "Iniciar ruta",
    finishRoute: "Cerrar ruta",
    stopStatus: {
      PENDING: "Pendiente",
      VISITED: "Visitado",
      COLLECTED: "Cobrado",
      NOT_FOUND: "No se encontró",
      PROMISED: "Prometió pagar",
      REFUSED: "Se negó a pagar",
    },
    emptyTitle: "Todavía no hay rutas",
    emptyHint: "Arma una ruta para organizar los cobros del día.",

    // --- Armar la ruta ---
    source: "¿Qué visitas incluir?",
    sourceDue: "Las cuotas que vencen ese día",
    sourceArrears: "Los préstamos en mora",
    sourceAll: "Todos los préstamos con cuotas pendientes",
    unassigned: "Sin cobrador asignado",
    assignCollector: "Asignar cobrador",
    assigned: "Ruta asignada.",

    // --- Trabajar la ruta ---
    open: "Abrir la ruta",
    progress: "Avance",
    visited: "Visitadas",
    pending: "Por visitar",
    ofTotal: "de {total}",
    routeClosed: "Ruta cerrada",
    closedNotice:
      "Esta ruta está cerrada. Para seguir cobrando en ella, vuelve a abrirla.",
    reopenRoute: "Volver a abrir",
    deleteRoute: "Eliminar la ruta",
    deleteRouteConfirm:
      "Se borra la ruta y sus visitas. Los cobros que ya hiciste no se tocan: quedan en el préstamo y en la caja.",
    visitResult: "¿Qué pasó en la visita?",
    visitSaved: "Visita registrada.",
    notes: "Nota de la visita",
    notesHint:
      "Lo que quieras recordar: quién atendió, qué dijo, cuándo volver.",

    // --- Cobrar ---
    collect: "Cobrar",
    collecting: "Cobrando…",
    collectHint:
      "Se registra el recibo, se aplica a las cuotas y entra a la caja.",
    collectedReceipt: "Cobrado. Recibo {receipt}.",
    alreadyCollected: "Ya cobrado",

    // --- Visitas ---
    addStop: "Agregar una visita",
    addStopHint:
      "Un préstamo que quieres incluir aunque no lo haya puesto el sistema.",
    stopAdded: "Visita agregada a la ruta.",
    removeStop: "Quitar de la ruta",
    moveUp: "Subir",
    moveDown: "Bajar",
    noPhone: "Sin teléfono",
    call: "Llamar",
    whatsapp: "WhatsApp",

    // --- Filtros de la lista ---
    filterDay: "Día",
    filterCollector: "Cobrador",
    allCollectors: "Todos",
    showClosed: "Ver también las cerradas",
    apply: "Filtrar",

    // --- Liquidación del cobrador ---
    settlement: "Liquidación del cobrador",
    settlementHint:
      "Cuenta el efectivo que trajo y compáralo con lo que dicen los recibos.",
    expectedCash: "Según los recibos",
    expectedCashHint: "Solo efectivo: una transferencia no pasa por sus manos.",
    delivered: "¿Cuánto entregó?",
    difference: "Diferencia",
    settleAction: "Cuadrar y cerrar la ruta",
    settling: "Cuadrando…",
    settlementBalanced: "La ruta cuadró exacto.",
    settlementShort: "Faltan {amount}. Quedó registrado a nombre del cobrador.",
    settlementOver: "Sobran {amount}. Quedó registrado.",
    settlementNotes: "¿Por qué la diferencia?",
    settlementNotesHint: "Lo que explicó el cobrador. Queda en el historial.",
    settledOn: "Liquidada el {date}",
    settledBy: "Recibido por",
    shortLabel: "Faltante",
    overLabel: "Sobrante",
    balancedLabel: "Cuadró",
    settleFirst:
      "Cierra la ruta con la liquidación, para que el efectivo quede cuadrado.",

    errors: {
      nameRequired: "Ponle un nombre a la ruta.",
      delivered: "Escribe cuánto efectivo entregó el cobrador.",
      alreadySettled: "Esta ruta ya fue liquidada.",
      notSettled: "Falta liquidar la ruta.",
      noStops:
        "No hay nada que cobrar con ese criterio ese día. Prueba con otro día o con otro filtro.",
      notFound: "No se encontró la ruta o la visita.",
      routeClosed:
        "La ruta está cerrada. Vuelve a abrirla para poder cambiarla.",
      alreadyOnRoute: "Ese préstamo ya está en la ruta.",
      amount: "El monto debe ser mayor que cero.",
      loanNotActive: "El préstamo no está activo.",
      nothingToApply: "Este préstamo no tiene cuotas pendientes.",
      settlesRefinance:
        "Este cobro es el saldo que se pasó a otro préstamo, no plata que entró. Para deshacerlo, anula el préstamo con el que se refinanció.",
    },
  },

  promises: {
    title: "Promesas de pago",
    subtitle: "Gente que ya dijo que sí. Solo hay que recordarles.",
    overdue: "Incumplidas y vencidas",
    overdueHint: "Prometieron y no pagaron. Aquí es donde se cobra.",
    dueToday: "Vencen hoy",
    dueTodayHint: "Llámalos antes de que se acabe el día.",
    upcoming: "Próximas",
    closed: "Cerradas",
    promised: "Prometió",
    paidSoFar: "Abonado",
    promisedFor: "Para el",
    daysLate: "{days} días de atraso",
    dayLate: "1 día de atraso",
    daysLeft: "En {days} días",
    dayLeft: "Mañana",
    dueTodayBadge: "Hoy",
    source: {
      ROUTE: "En la ruta",
      CALL: "Por teléfono",
      MANUAL: "A mano",
    },
    status: {
      PENDING: "Pendiente",
      KEPT: "Cumplió",
      BROKEN: "No cumplió",
      CANCELLED: "Anulada",
    },
    cancel: "Anular la promesa",
    cancelled: "Promesa anulada.",
    record: "Cumplimiento",
    recordSummary: "Cumplió {kept} de {settled} promesas",
    recordNone: "Sin promesas cerradas",
    reliability: "{percent}% de cumplimiento",
    emptyTitle: "No hay promesas de pago",
    emptyHint:
      "Cuando alguien prometa pagar, en la ruta o por teléfono, aparece aquí.",
    seeCustomer: "Ver el cliente",
    seeLoan: "Ver el préstamo",
  },

  cash: {
    title: "Caja y bancos",
    singular: "Caja",
    new: "Nueva caja o cuenta",
    name: "Nombre",
    kind: "Tipo",
    accountNumber: "Número de cuenta",
    balance: "Saldo",
    movements: "Movimientos",
    deposit: "Depósito",
    withdrawal: "Retiro",
    transfer: "Transferencia",
    balanceAfter: "Saldo después",
    kindLabel: {
      CASH: "Efectivo",
      BANK: "Banco",
    },
    movementLabel: {
      DEPOSIT: "Depósito",
      WITHDRAWAL: "Retiro",
      LOAN_DISBURSEMENT: "Desembolso de préstamo",
      CHARGE_COLLECTED: "Cargos del préstamo",
      PAYMENT_RECEIVED: "Cobro recibido",
      EXPENSE: "Gasto",
      TRANSFER_IN: "Transferencia recibida",
      TRANSFER_OUT: "Transferencia enviada",
      ADJUSTMENT: "Ajuste",
    },
    emptyTitle: "Todavía no hay cajas",
    emptyHint: "Crea una caja para registrar el dinero del negocio.",
  },

  expenses: {
    title: "Gastos",
    singular: "Gasto",
    new: "Nuevo gasto",
    category: "Categoría",
    categories: "Categorías de gasto",
    newCategory: "Nueva categoría",
    description: "Descripción",
    spentAt: "Fecha del gasto",
    linkedLoan: "Préstamo relacionado",
    emptyTitle: "Todavía no hay gastos",
    emptyHint: "Registra los gastos para ver la ganancia real.",
  },

  reports: {
    title: "Reportes",
    portfolio: "Cartera",
    collection: "Cobranza",
    arrears: "Mora",
    profitability: "Rentabilidad",
    productivity: "Productividad por cobrador",
    cashFlow: "Flujo de caja",
    period: "Período",
    generate: "Generar reporte",
    exportPdf: "Exportar a PDF",
    exportCsv: "Exportar a CSV",
  },

  templates: {
    title: "Plantillas",
    singular: "Plantilla",
    new: "Nueva plantilla",
    key: "Clave interna",
    name: "Nombre",
    kind: "Tipo",
    subject: "Asunto",
    body: "Contenido",
    preview: "Vista previa",
    variables: "Variables disponibles",
    variablesHint:
      "Encierra la variable entre llaves dobles donde quieras insertar un dato. Haz clic en una variable para agregarla.",
    kindLabel: {
      WHATSAPP: "WhatsApp",
      SMS: "SMS",
      EMAIL: "Correo electrónico",
      DOCUMENT: "Documento",
      RECEIPT: "Recibo",
      CONTRACT: "Contrato",
    },
    emptyTitle: "Todavía no hay plantillas",
    emptyHint:
      "Crea plantillas para no escribir el mismo mensaje una y otra vez.",
    unknownVariable: "La variable {name} no existe.",
  },

  messaging: {
    title: "Mensajería",
    accounts: "Cuentas conectadas",
    newAccount: "Conectar cuenta",
    channel: "Canal",
    provider: "Proveedor",
    displayName: "Nombre visible",
    phoneNumber: "Número de teléfono",
    isDefault: "Cuenta principal",
    outbox: "Mensajes enviados",
    queue: "Cola de envío",
    sendNow: "Enviar ahora",
    sendTest: "Enviar prueba",
    scheduledFor: "Programado para",
    failureReason: "Motivo del fallo",
    automation: "Automatizaciones",
    newRule: "Nueva automatización",
    ruleName: "Nombre de la automatización",
    trigger: "Cuándo se envía",
    offsetDays: "Días",
    sendAtTime: "Hora de envío",
    template: "Plantilla",
    channelLabel: {
      WHATSAPP: "WhatsApp",
      SMS: "SMS",
      EMAIL: "Correo electrónico",
    },
    statusLabel: {
      QUEUED: "En cola",
      SENDING: "Enviando",
      SENT: "Enviado",
      DELIVERED: "Entregado",
      READ: "Leído",
      FAILED: "Falló",
      CANCELLED: "Cancelado",
    },
    triggerLabel: {
      BEFORE_DUE_DATE: "Antes del vencimiento de la cuota",
      ON_DUE_DATE: "El día del vencimiento",
      AFTER_DUE_DATE: "Después del vencimiento, si sigue sin pagar",
      ARREARS_THRESHOLD: "Al llegar a cierta cantidad de días de mora",
      ON_PAYMENT_POSTED: "Al registrar un cobro",
      ON_LOAN_DISBURSED: "Al desembolsar un préstamo",
    },
    providerLabel: {
      cloud_api: "WhatsApp Business API (oficial)",
      bridge: "Mi propio WhatsApp (puente)",
      log: "Solo registrar (modo prueba)",
    },
    emptyTitle: "Todavía no hay mensajes",
    emptyHint:
      "Conecta tu WhatsApp y crea una automatización para cobrar solo.",
    noAccount:
      "No hay ninguna cuenta de WhatsApp conectada. Conecta una para poder enviar.",
  },

  callCenter: {
    title: "Call center",
    campaigns: "Campañas",
    campaign: "Campaña",
    newCampaign: "Nueva campaña",
    queue: "Cola de gestión",
    myQueue: "Mi cola",
    interactions: "Gestiones",
    newInteraction: "Registrar gestión",
    agent: "Agente",
    channel: "Canal",
    outcome: "Resultado",
    duration: "Duración",
    promisedAmount: "Monto prometido",
    promisedFor: "Fecha prometida",
    followUpAt: "Volver a contactar",
    occurredAt: "Fecha de la gestión",
    callNow: "Llamar",
    whatsappNow: "Enviar WhatsApp",
    nextCustomer: "Siguiente cliente",
    campaignStatus: {
      DRAFT: "Borrador",
      RUNNING: "En curso",
      PAUSED: "En pausa",
      FINISHED: "Finalizada",
    },
    channelLabel: {
      CALL: "Llamada",
      WHATSAPP: "WhatsApp",
      SMS: "SMS",
      EMAIL: "Correo electrónico",
      VISIT: "Visita",
      NOTE: "Nota interna",
    },
    outcomeLabel: {
      PENDING: "Pendiente",
      CONTACTED: "Contactado",
      NO_ANSWER: "No contestó",
      WRONG_NUMBER: "Número equivocado",
      PAYMENT_PROMISED: "Prometió pagar",
      PAYMENT_MADE: "Pagó",
      REFUSED: "Se negó a pagar",
      DISPUTE: "Reclamo",
      CALLBACK_REQUESTED: "Pidió que lo llamen luego",
    },
    filters: {
      minDaysInArrears: "Mora mínima (días)",
      maxDaysInArrears: "Mora máxima (días)",
      minAmount: "Monto mínimo adeudado",
    },
    emptyQueue: "No hay clientes pendientes de gestionar. Buen trabajo.",
    emptyTitle: "Todavía no hay campañas",
    emptyHint: "Crea una campaña para organizar la cobranza telefónica.",
  },

  moduleBuilder: {
    title: "Constructor de módulos",
    subtitle:
      "Crea módulos y campos propios. Aparecen en el menú como cualquier otro.",
    entities: "Módulos creados",
    newEntity: "Nuevo módulo",
    entityName: "Nombre (singular)",
    entityPluralName: "Nombre (plural)",
    entityKey: "Clave interna",
    entityKeyHint:
      "Solo letras, números y guiones bajos. No se puede cambiar después.",
    icon: "Ícono",
    extendsKey: "Ampliar un módulo existente",
    extendsNone: "Módulo independiente",
    extendsHint:
      "Si eliges un módulo existente, los campos se agregan a su formulario en vez de crear un módulo nuevo.",
    fields: "Campos",
    newField: "Nuevo campo",
    fieldLabel: "Etiqueta",
    fieldKey: "Clave interna",
    fieldType: "Tipo de dato",
    isRequired: "Obligatorio",
    isUnique: "No permitir repetidos",
    showInList: "Mostrar en el listado",
    helpText: "Texto de ayuda",
    defaultValue: "Valor por defecto",
    options: "Opciones",
    optionValue: "Valor",
    optionLabel: "Etiqueta",
    addOption: "Agregar opción",
    records: "Registros",
    newRecord: "Nuevo registro",
    fieldTypeLabel: {
      TEXT: "Texto corto",
      LONG_TEXT: "Texto largo",
      NUMBER: "Número",
      CURRENCY: "Dinero",
      DATE: "Fecha",
      DATETIME: "Fecha y hora",
      BOOLEAN: "Sí / No",
      SELECT: "Lista desplegable",
      MULTI_SELECT: "Lista de selección múltiple",
      PHONE: "Teléfono",
      EMAIL: "Correo electrónico",
      URL: "Enlace web",
      FILE: "Archivo",
    },
    extendable: {
      customer: "Clientes",
      loan: "Préstamos",
      payment: "Cobros",
    },
    emptyTitle: "Todavía no has creado módulos",
    emptyHint:
      "Con el constructor puedes agregar lo que tu negocio necesite sin programar.",
    errors: {
      keyTaken: "Ya existe un módulo con esa clave.",
      keyFormat: "La clave solo puede tener letras, números y guiones bajos.",
      fieldKeyTaken: "Ya existe un campo con esa clave en este módulo.",
    },
  },

  settings: {
    title: "Configuración",
    companyTab: "Empresa",
    branchesTab: "Sucursales",
    usersTab: "Usuarios",
    rolesTab: "Roles y permisos",
    modulesTab: "Módulos",
    loanProductsTab: "Tipos de préstamo",
    labelsTab: "Textos y etiquetas",
    companyName: "Nombre comercial",
    legalName: "Razón social",
    taxId: "RNC / identificación fiscal",
    currency: "Moneda",
    timezone: "Zona horaria",
    logo: "Logo",

    companyTitle: "Datos de la empresa",
    identityTitle: "Identificación",
    companyHint:
      "Aparecen en los recibos, los contratos y los mensajes que se le mandan al cliente.",
    companyEmail: "Correo de la empresa",
    companyPhone: "Teléfono de la empresa",
    companyAddress: "Dirección",
    country: "País",
    city: "Ciudad",
    stateGeneric: "Provincia / Departamento",
    location: "Ubicación de la oficina",
    locationHint:
      "Se guarda el punto exacto, para que las rutas de cobro puedan salir desde aquí.",
    logoHint: "Sale en los recibos y arriba a la izquierda.",
    regionTitle: "Moneda y formato",
    regionHint:
      "Al elegir el país se llenan solos la moneda, la zona horaria y el formato de fechas. Puedes cambiarlos después.",
    decimals: "Decimales en los montos",
    decimalsHint:
      "Dos para pesos dominicanos o mexicanos. Cero para pesos colombianos, chilenos y guaraníes, donde no se usan centavos.",
    decimalsNone: "Sin decimales (1.250)",
    decimalsTwo: "Dos decimales (1,250.00)",
    preview: "Así se van a ver los montos",
    saved: "Los datos de la empresa quedaron guardados.",
    branches: "Sucursales",
    newBranch: "Nueva sucursal",
    users: "Usuarios",
    newUser: "Nuevo usuario",
    role: "Rol",
    roles: "Roles",
    newRole: "Nuevo rol",
    permissions: "Permisos",
    modulesTitle: "Módulos del sistema",
    modulesHint:
      "Activa solo lo que uses. Los módulos base no se pueden desactivar.",
    // Va en una insignia al lado del módulo, donde los demás tienen su botón:
    // dice de una por qué a ese no se le puede dar. La frase larga de antes no
    // cabía en el teléfono y salía cortada contra el borde.
    moduleRequired: "Siempre activo",
    moduleDependency: "Necesitas activar «{module}» antes de usar este módulo.",
    moduleDependents:
      "Si desactivas este módulo también se desactivará: {modules}.",
    newUserTitle: "Nuevo usuario",
    editUserTitle: "Editar usuario",
    userFullName: "Nombre completo",
    userEmail: "Correo electrónico",
    userUsername: "Nombre de usuario",
    userUsernameHint: "Con este nombre o con el correo va a entrar al sistema.",
    userPhone: "Teléfono",
    userPassword: "Contraseña",
    userPasswordHint: "Mínimo 8 caracteres.",
    userPasswordRepeat: "Repetir contraseña",
    userActive: "Puede entrar al sistema",
    resetPassword: "Cambiar la contraseña",
    resetPasswordDone: "Contraseña actualizada. Se cerraron sus sesiones.",
    deactivate: "Desactivar",
    activate: "Activar",
    userErrors: {
      emailTaken: "Ya existe un usuario con ese correo.",
      usernameTaken: "Ya existe un usuario con ese nombre.",
      invalidUsername:
        "El nombre de usuario debe tener entre 3 y 30 caracteres, sin arroba ni espacios.",
      weakPassword: "La contraseña debe tener al menos 8 caracteres.",
      passwordMismatch: "Las dos contraseñas no coinciden.",
      wrongPassword: "La contraseña actual no es correcta.",
      notFound: "No se encontró el usuario.",
      lastOwner:
        "No puedes quitar al último dueño: nadie podría volver a administrar el sistema.",
    },
    labelsTitle: "Personalizar textos",
    labelsHint:
      "Cambia cualquier texto del sistema por el que use tu empresa. Deja el campo vacío para volver al original.",
    labelOriginal: "Texto original",
    labelCustom: "Tu texto",
    // La pantalla va por partes, y cada parte con su nombre: antes era un
    // solo rollo de cinco pantallas donde todo pesaba igual.
    accessTitle: "Quién entra",
    accessHint:
      "Las personas que usan el sistema y lo que cada una puede hacer.",
    companySectionHint:
      "El nombre, la moneda y la hora con que se hacen los recibos y los contratos.",
    language: "Idioma",
    decimalsShort: "Decimales",
    // Los módulos, agrupados por lo que hacen. Catorce en una sola lista no se
    // leen; en cuatro grupos se sabe dónde buscar.
    moduleCategory: {
      core: "Lo básico",
      operations: "La operación del día",
      communication: "Mensajes y llamadas",
      customization: "A tu medida",
    },
    moduleCategoryHint: {
      core: "Lo que hace funcionar el negocio. No se puede apagar.",
      operations: "Rutas, promesas, caja, gastos y reportes.",
      communication: "Plantillas, llamadas y mensajes automáticos.",
      customization: "Para armar tus propios módulos y campos.",
    },
    // Los textos que se pueden cambiar, por temas. Ordenados por su clave
    // interna salían dos «Clientes» seguidos y nadie sabía cuál era cuál.
    labelGroup: {
      business: "El nombre del negocio",
      words: "Las palabras del día a día",
      menu: "Los nombres del menú",
    },
    labelGroupHint: {
      business: "Sale arriba a la izquierda y en los recibos.",
      words: "Cómo le dices tú a un préstamo, a un cliente, a la cuota.",
      menu: "Los nombres que se ven en el menú y en la barra de abajo.",
    },
    labelUnchanged: "Sin cambiar",
  },

  // --- La central de riesgo -----------------------------------------------
  credit: {
    title: "Central de riesgo",
    subtitle:
      "Consulta por cédula antes de prestar, y reporta al que te quedó debiendo.",
    // Consultar
    lookupTitle: "Consultar una cédula",
    lookupHint:
      "Escribe el número de documento, completo y sin puntos. Se busca exacto: no hay búsqueda por nombre.",
    document: "Número de documento",
    lookupAction: "Consultar",
    clean: "Sin reportes",
    cleanHint:
      "Este documento no aparece reportado por ninguna oficina. Eso no dice que sea buena paga: dice que nadie lo ha reportado.",
    found: "{count} reportes activos",
    foundOne: "1 reporte activo",
    inCompanies: "en {count} oficinas",
    inCompaniesOne: "en 1 oficina",
    totalOwed: "Debe en total",
    reportedBy: "Reportado por",
    yourCompany: "Tu oficina",
    reportedOn: "Reportado el",
    expiresOn: "Se borra el",
    noticedOn: "Se le avisó el",
    severityLabel: {
      LATE: "Pagó tarde",
      DEFAULT: "Quedó debiendo",
      FRAUD: "Fraude",
    },
    severityHint: {
      LATE: "Se atrasó y se puso al día tarde, pero pagó. Se borra a los 2 años.",
      DEFAULT: "Dejó de pagar y quedó debiendo. Se borra a los 4 años.",
      FRAUD:
        "Dio datos falsos o desapareció con la plata. Se borra a los 6 años.",
    },
    // Reportar
    reportAction: "Reportar al cliente",
    reportTitle: "Reportar a {name}",
    reportHint:
      "Queda visible para cualquier oficina que consulte esta cédula. Se puede retirar cuando pague.",
    severity: "¿Qué pasó?",
    amount: "Cuánto quedó debiendo",
    reason: "Qué pasó, en tus palabras",
    reasonPlaceholder: "Dejó de contestar desde la tercera cuota.",
    noticedAt: "¿Qué día le avisaste que lo ibas a reportar?",
    noticedAtHint:
      "Antes de reportar a alguien hay que avisarle y darle {days} días para ponerse al día. Sin esa fecha no se puede reportar.",
    reportSubmit: "Reportar",
    reported: "{name} quedó reportado.",
    // Retirar
    withdrawAction: "Retirar el reporte",
    withdrawTitle: "Retirar el reporte de {name}",
    withdrawHint:
      "Deja de verse en las consultas. No se borra: queda el rastro de que existió y de por qué se quitó.",
    withdrawReason: "¿Por qué lo retiras?",
    withdrawReasonPlaceholder: "Pagó todo el 5 de septiembre.",
    withdrawSubmit: "Retirar",
    withdrawn: "El reporte quedó retirado.",
    withdrawnOn: "Retirado el",
    // Mis reportes
    ownTitle: "Lo que tú has reportado",
    ownEmpty: "Todavía no has reportado a nadie.",
    statusLabel: {
      ACTIVE: "Activo",
      WITHDRAWN: "Retirado",
    },
    // El aviso en la ficha
    flagTitle: "Reportado en la central de riesgo",
    flagOne: "Una oficina lo tiene reportado.",
    flagMany: "{count} oficinas lo tienen reportado.",
    flagSee: "Ver el reporte",
    // Quién consultó
    lookupsTitle: "Quién ha consultado esta cédula",
    lookupsHint:
      "Toda consulta queda registrada: la persona reportada tiene derecho a saber quién pidió sus datos.",
    lookupsEmpty: "Nadie ha consultado esta cédula todavía.",
    lookupFound: "encontró {count}",
    lookupNothing: "no encontró nada",
    errors: {
      document:
        "Escribe un número de documento completo, de al menos 5 caracteres.",
      name: "Falta el nombre de la persona.",
      amount: "El monto no puede ser negativo.",
      alreadyReported:
        "Ya tienes reportado a este cliente por este préstamo. Retira el reporte anterior si quieres cambiarlo.",
      notFound: "No se encontró.",
      notYours:
        "Este reporte lo hizo otra oficina. Solo quien reporta puede retirar su reporte.",
      noticeMissing:
        "Primero avísale al cliente y pon aquí la fecha en que le avisaste. Reportar a alguien sin avisarle no se puede.",
      noticeTooRecent:
        "Todavía no. Desde el aviso tienen que pasar {days} días para poder reportarlo.",
      withdrawReason: "Escribe por qué lo estás retirando.",
      noDocument:
        "Este cliente no tiene número de documento, y el documento es con lo que otra oficina lo encontraría.",
    },
  },

  roles: {
    owner: "Dueño",
    manager: "Administrador",
    collector: "Cobrador",
    agent: "Agente de call center",
    viewer: "Solo consulta",
  },

  permissions: {
    resource: {
      dashboard: "Inicio",
      customers: "Clientes",
      loans: "Préstamos",
      payments: "Cobros",
      collections: "Rutas de cobro",
      promises: "Promesas de pago",
      cash: "Caja y bancos",
      expenses: "Gastos",
      reports: "Reportes",
      templates: "Plantillas",
      callCenter: "Call center",
      messaging: "Mensajería",
      moduleBuilder: "Constructor de módulos",
      credit: "Central de riesgo",
      settings: "Configuración",
      users: "Usuarios",
      audit: "Auditoría",
    },
    action: {
      read: "Ver",
      create: "Crear",
      update: "Editar",
      delete: "Eliminar",
      approve: "Aprobar",
      export: "Exportar",
    },
    denied: "No tienes permiso para ver esta sección.",
  },

  validation: {
    required: "Este campo es obligatorio.",
    email: "Escribe un correo electrónico válido.",
    phone: "Escribe un teléfono válido.",
    number: "Escribe un número válido.",
    positive: "El valor debe ser mayor que cero.",
    integer: "Debe ser un número entero.",
    minLength: "Debe tener al menos {min} caracteres.",
    maxLength: "No puede pasar de {max} caracteres.",
    date: "Escribe una fecha válida.",
    unique: "Ese valor ya está en uso.",
  },
} as const;

export type Dictionary = typeof es;
