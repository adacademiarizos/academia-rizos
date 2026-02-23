export const site = {
  brand: "ElizabethRizos",
  tagline: "Donde mejor tratan a tus rizos en Palma de Mallorca",
  welcome:
    "Bienvenid@ a ElizabethRizos, donde celebramos la belleza y diversidad de los cabellos curly. Nuestro equipo de expertos se dedica a realzar la belleza natural de tu cabello, ofreciendo cortes, estilos y tratamientos específicos para cabellos curly. Además de cuidar de tu cabello, valoramos la comunidad y la cultura curly, creando un espacio acogedor donde puedes conectar con otros amantes de la belleza curly.",
  services: [
    {
      title: "Diagnóstico + Rutina" ,
      desc: "Evaluación del rizo, porosidad, densidad y plan personalizado." ,
      duration: "45-60 min" ,
      from: "$" ,
      href: "/booking?service=diagnostico" ,
      imgUri: "/persona2.webp",
    }, {
      title:"Definición & Styling" ,
      desc:"Técnica de definición + productos según tu textura." ,
      duration:"90-120 min" ,
      from:"$$" ,
      href:"/booking?service=definicion"  ,
      imgUri: "/persona2.webp",
    } , {
      title:"Corte Curly" ,
      desc:"Corte adaptado a tu patrón con enfoque en forma y volumen." ,
      duration:"60-90 min" ,
      from:"$$" ,
      href:"/booking?service=corte" ,
      imgUri: "/persona2.webp",
    }
  ],
  team: [
    { name: "Elizabeth Acosta", role: "Amante apasionada por su trabajo y su sueño." },
    { name: "Alexis Perez", role: "Dedicada, humilde y con muchas ganas." },
  ],
  testimonials: [
    {
      name: "Antonia",
      role: "Clienta",
      text:
        "Guau, me ha encantado como me dejaste ese pelo y lo hermosa que estoy. Dios te siga bendiciendo esa maravillosa mano. Me encanta cómo trabajas y la dedicación que pones.",
    },
    {
      name: "Vanesa",
      role: "Clienta",
      text: "Mi entrenadora de Gym quedó encantada contigo, necesito una cita para ya de ya.",
    },
    {
      name: "Beth",
      role: "Clienta",
      text:
        "Ojalá venga pronto a verte. ¡No he visto en redes otra que se dedique a esto y por lo menos se asemeje a ti!! Gracias por ayudarnos",
    },
    {
      name: "Camila",
      role: "Clienta",
      text:
        "Madre mía, el tratamiento que me enseñaste a hacer de romero y jengibre me fue espectacular y he conseguido más cabellos que con las pastillas que me recetó el médico.",
    },
    {
      name: "Daniela",
      role: "Clienta",
      text:
        "De verdad que mil gracias, mi hija está encantada y en el cole ni te cuento. A estas edades su cabello es muy importante. Tiene gracias, me dice que no quiere que nadie más que tú le toque el pelo.",
    },
  ],
  hours: {
    days: "Lunes a Sábado",
    time: "09:30am – 18:00pm",
  },
  contact: {
    phone: "971668916",
    address: "Carretera de Valldemossa, 33, 07010 Palma, Illes Balears",
  },
} as const;
