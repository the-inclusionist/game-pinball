// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/es — Español. Written from `i18n/pt`, which is the base; a missing key falls back to it.
//
// The words are this project's own, not a translation of the original's. Held to the same 63-pixel
// column as every other locale — see `i18n/keys`.

const es: Record<string, string> = {
  /* ===================== MISIONES ===================== */
  'pinball.mission.bumpers.run': 'Golpea los topes: faltan {n}',
  'pinball.mission.practice.done': 'Entrenamiento hecho.',
  'pinball.mission.alienMenace2.done': 'Amenaza repelida.',

  'pinball.mission.launchTraining.run': 'Sube la rampa: faltan {n}',
  'pinball.mission.launchTraining.done': 'Lanzamiento aprobado.',
  'pinball.mission.reentryTraining.run': 'Recorre los carriles: faltan {n}',
  'pinball.mission.reentryTraining.done': 'Reentrada aprobada.',
  'pinball.mission.science.run': 'Blancos de estudio: faltan {n}',
  'pinball.mission.science.done': 'Estudio completo.',
  'pinball.mission.bugHunt.run': 'Caza de insectos: faltan {n}',
  'pinball.mission.bugHunt.done': 'Plaga eliminada.',
  'pinball.mission.satellite.run': 'Reactiva el satélite: faltan {n}',
  'pinball.mission.satellite.done': 'Satélite en línea.',
  'pinball.mission.recon.run': 'Reconocimiento: faltan {n}',
  'pinball.mission.recon.done': 'Sector cartografiado.',
  'pinball.mission.doomsday.run': 'Desarma la máquina: faltan {n}',
  'pinball.mission.doomsday.done': 'Máquina desarmada.',
  'pinball.mission.plague.run': 'Gira las banderas: faltan {n}',
  'pinball.mission.plague2.run': 'Lleva la muestra al laboratorio.',
  'pinball.mission.plague2.done': 'Plaga contenida.',
  'pinball.mission.secretYellow.run': 'Entra en el pozo amarillo.',
  'pinball.mission.secretRed.run': 'Entra en el pozo rojo.',
  'pinball.mission.secretGreen.run': 'Entra en el pozo verde.',
  'pinball.mission.secretGreen.done': 'Misión secreta cumplida.',
  'pinball.mission.timeWarp.run': 'Golpea los rebotadores: faltan {n}',

  'pinball.mission.maelstrom1.run': 'Maelstrom: blancos izquierdos, {n}',
  'pinball.mission.maelstrom2.run': 'Maelstrom: blancos derechos, {n}',
  'pinball.mission.maelstrom3.run': 'Maelstrom: los carriles, faltan {n}',
  'pinball.mission.maelstrom4.run': 'Maelstrom: el rodillo de fuel.',
  'pinball.mission.maelstrom5.run': 'Maelstrom: sube la rampa.',
  'pinball.mission.maelstrom6.run': 'Maelstrom: gira las banderas.',
  'pinball.mission.maelstrom7.run': 'Maelstrom: cualquier pozo.',
  'pinball.mission.maelstrom8.run': 'Maelstrom: la patada final.',
  'pinball.mission.maelstrom8.info': 'Hiperespacio abierto.',

  'pinball.mission.waiting.run': 'Tira del émbolo para lanzar.',
  'pinball.mission.select.run': 'Elige misión en los blancos.',
  'pinball.mission.alienMenace.run': 'Sube el nivel de los topes.',
  'pinball.mission.gameOver.run': 'Fin del juego.',
  'pinball.mission.strayComet.run': 'Tumba los tres blancos derechos.',
  'pinball.mission.strayComet.stage2': 'Ahora el eyector derecho.',
  'pinball.mission.strayComet.done': 'Cometa desviado.',
  'pinball.mission.blackHole.run': 'Sube un nivel el tope cinco.',
  'pinball.mission.blackHole.stage2': 'Ahora el eyector del fondo.',
  'pinball.mission.blackHole.done': 'Agujero negro sellado.',
  'pinball.mission.radiation.run': 'Tumba los tres blancos izquierdos.',
  'pinball.mission.radiation.stage2': 'Ahora cualquier pozo.',
  'pinball.mission.radiation.done': 'Radiación contenida.',
  'pinball.mission.rescue.run': 'Golpea los blancos izquierdos.',
  'pinball.mission.rescue.stage2': 'Ahora el eyector: ¡rescate!',
  'pinball.mission.rescue.done': 'Tripulación rescatada.',
  'pinball.mission.timeWarp2.run': 'Rampa asciende, eyector baja.',
  'pinball.mission.timeWarp2.promoted': 'Ascendido a {rank}.',
  'pinball.mission.timeWarp2.demoted': 'Degradado a {rank}.',

  'pinball.award.scored': '{points} puntos',

  /* ===================== HUD ===================== */
  'pinball.a11y.blindOn': 'Modo ciego activado. Pulsa S para barrer la mesa.',
  'pinball.a11y.blindOff': 'Modo ciego desactivado.',
  'pinball.demo.ask': 'Modo demostración: elige tu PINBALL.DAT. El archivo no sale de esta máquina.',
  'pinball.demo.caveat': 'Muestra la mesa y la física de 1995. Todavía no puntúa, no enciende luces ni ejecuta misiones.',
  'pinball.demo.failed': 'No pude leer ese archivo: {n}',
  'pinball.event.bumpersRaised': 'Los bumpers valen más.',
  'pinball.hud.score': 'Puntuación: {n}',
  'pinball.objective.authored': 'Objetivos por encender: {n}',
  'pinball.hud.player': 'Jugador {n}',
  'pinball.hud.balls': 'Bolas: {n}',
  'pinball.hud.gameOver': 'Fin del juego',
  'pinball.hud.shootAgain': 'Juega de nuevo',
  'pinball.hud.waiting': 'Tira del émbolo.',
};

export default es;
