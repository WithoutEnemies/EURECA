// Componente generico de icone.
// Em vez de criar um SVG separado para cada botao, o nome escolhe um desenho da tabela abaixo.
export function Icon({ name }) {
  const paths = {
    home: 'M3 10.5 12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z',
    compass:
      'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm3.7 6.3-2.2 5.5-5.5 2.2 2.2-5.5 5.5-2.2Z',
    bell: 'M12 4a4 4 0 0 0-4 4v2.6c0 .5-.2 1-.5 1.4L6 14h12l-1.5-2c-.3-.4-.5-.9-.5-1.4V8a4 4 0 0 0-4-4Zm0 16a2.5 2.5 0 0 0 2.4-2h-4.8a2.5 2.5 0 0 0 2.4 2Z',
    chat: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    user: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z',
    settings:
      'M12 8.5A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5Zm8 4.3-1.7-.6a6.7 6.7 0 0 0-.4-1l.8-1.6-1.8-1.8-1.6.8a6.7 6.7 0 0 0-1-.4L14.8 4h-2.6l-.5 1.8a6.7 6.7 0 0 0-1 .4l-1.6-.8-1.8 1.8.8 1.6a6.7 6.7 0 0 0-.4 1L4 11.2v2.6l1.8.5a6.7 6.7 0 0 0 .4 1l-.8 1.6 1.8 1.8 1.6-.8a6.7 6.7 0 0 0 1 .4l.5 1.8h2.6l.5-1.8a6.7 6.7 0 0 0 1-.4l1.6.8 1.8-1.8-.8-1.6a6.7 6.7 0 0 0 .4-1l1.8-.5Z',
    image:
      'M5 5h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm2 10 3-3 2.5 2.5L15 10l4 5H7Zm2-6.5a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 9 8.5Z',
    smile:
      'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm-3 7a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 9 10Zm6 0a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 15 10Zm-6.1 4h6.2a3.6 3.6 0 0 1-6.2 0Z',
    calendar:
      'M7 3v2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2V3h-2v2H9V3H7Zm12 7H5v8h14v-8Z',
    reply: 'M10 7 4 12l6 5v-4h4a6 6 0 0 1 6 6v-2a10 10 0 0 0-10-10Z',
    repost:
      'M7 7h9l-2-2 1.4-1.4L20.8 9l-5.4 5.4L14 13l2-2H7a3 3 0 0 0-3 3v1H2v-1a5 5 0 0 1 5-5Zm10 6H8l2 2-1.4 1.4L3.2 11l5.4-5.4L10 7l-2 2h9a5 5 0 0 1 5 5v1h-2v-1a3 3 0 0 0-3-3Z',
    heart:
      'M12 20.5 10.6 19C5.1 14 2 11.1 2 7.5A4.5 4.5 0 0 1 6.5 3 5 5 0 0 1 12 6.2 5 5 0 0 1 17.5 3 4.5 4.5 0 0 1 22 7.5c0 3.6-3.1 6.5-8.6 11.5L12 20.5Z',
    chart: 'M4 20V8h3v12H4Zm6 0V4h3v16h-3Zm6 0v-9h3v9h-3Zm-14 2h20v2H2z',
    share:
      'M18 16a3 3 0 0 0-2.4 1.2L9.4 13a3.3 3.3 0 0 0 0-2l6.2-4.2A3 3 0 1 0 14.8 5L8.6 9.2a3 3 0 1 0 0 5.6l6.2 4.2A3 3 0 1 0 18 16Z',
    trash:
      'M8 4h8l1 2h4v2H3V6h4l1-2Zm1 6h2v8H9v-8Zm4 0h2v8h-2v-8Zm5-2-1 13H7L6 8h12Z',
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

// Simbolo principal da marca Eureca usado no topo e na tela de login.
export function WaveMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M3 12c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M3 16c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
    </svg>
  )
}
