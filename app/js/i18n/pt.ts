// SPDX-License-Identifier: AGPL-3.0-or-later
// i18n/pt — pt-BR, and the base every other locale falls back to.
//
// THE WORDS ARE THIS PROJECT'S OWN. They are not a translation of the original's strings, which belong
// to Microsoft and are not carried here; they are written for this table from what each mission asks
// the player to do. See `i18n/keys`.
//
// SHORT ON PURPOSE. ADR-0002 gives the mission text a 63-pixel column — about fifteen characters a
// line over four lines. Writing to that width is the HUD decision arriving as a writing constraint, and
// a test refuses anything longer.
//
// `{n}` is what remains to be done and `{points}` a score. The FRAME translates and the NUMBER passes
// through, which is the engine's own rule for parameters.

const pt: Record<string, string> = {
  /* ===================== MISSIONS ===================== */
  'pinball.mission.bumpers.run': 'Acerte os para-choques: faltam {n}',
  'pinball.mission.practice.done': 'Treino concluído.',
  'pinball.mission.alienMenace2.done': 'Ameaça repelida.',

  'pinball.mission.launchTraining.run': 'Suba a rampa: faltam {n}',
  'pinball.mission.launchTraining.done': 'Lançamento aprovado.',
  'pinball.mission.reentryTraining.run': 'Passe pelas pistas: faltam {n}',
  'pinball.mission.reentryTraining.done': 'Reentrada aprovada.',
  'pinball.mission.science.run': 'Alvos de pesquisa: faltam {n}',
  'pinball.mission.science.done': 'Pesquisa concluída.',
  'pinball.mission.bugHunt.run': 'Caça aos insetos: faltam {n}',
  'pinball.mission.bugHunt.done': 'Praga eliminada.',
  'pinball.mission.satellite.run': 'Reative o satélite: faltam {n}',
  'pinball.mission.satellite.done': 'Satélite no ar.',
  'pinball.mission.recon.run': 'Reconhecimento: faltam {n}',
  'pinball.mission.recon.done': 'Setor mapeado.',
  'pinball.mission.doomsday.run': 'Desarme a máquina: faltam {n}',
  'pinball.mission.doomsday.done': 'Máquina desarmada.',
  'pinball.mission.plague.run': 'Gire as bandeiras: faltam {n}',
  'pinball.mission.plague2.run': 'Leve a amostra ao laboratório.',
  'pinball.mission.plague2.done': 'Praga contida.',
  'pinball.mission.secretYellow.run': 'Entre no poço amarelo.',
  'pinball.mission.secretRed.run': 'Entre no poço vermelho.',
  'pinball.mission.secretGreen.run': 'Entre no poço verde.',
  'pinball.mission.secretGreen.done': 'Missão secreta cumprida.',
  'pinball.mission.timeWarp.run': 'Bata nos amortecedores: faltam {n}',

  'pinball.mission.maelstrom1.run': 'Maelstrom: alvos da esquerda, faltam {n}',
  'pinball.mission.maelstrom2.run': 'Maelstrom: alvos da direita, faltam {n}',
  'pinball.mission.maelstrom3.run': 'Maelstrom: as pistas, faltam {n}',
  'pinball.mission.maelstrom4.run': 'Maelstrom: o rolo de combustível.',
  'pinball.mission.maelstrom5.run': 'Maelstrom: suba a rampa.',
  'pinball.mission.maelstrom6.run': 'Maelstrom: gire as bandeiras.',
  'pinball.mission.maelstrom7.run': 'Maelstrom: qualquer poço.',
  'pinball.mission.maelstrom8.run': 'Maelstrom: o chute final.',
  'pinball.mission.maelstrom8.info': 'Hiperespaço liberado.',

  'pinball.mission.waiting.run': 'Puxe o êmbolo para lançar.',
  'pinball.mission.select.run': 'Escolha uma missão nos alvos.',
  'pinball.mission.alienMenace.run': 'Suba o nível dos para-choques.',
  'pinball.mission.gameOver.run': 'Fim de jogo.',
  'pinball.mission.strayComet.run': 'Derrube os três alvos da direita.',
  'pinball.mission.strayComet.stage2': 'Agora o ejetor da direita.',
  'pinball.mission.strayComet.done': 'Cometa desviado.',
  'pinball.mission.blackHole.run': 'Suba o nível do para-choque 5.',
  'pinball.mission.blackHole.stage2': 'Agora o ejetor do fundo.',
  'pinball.mission.blackHole.done': 'Buraco negro selado.',
  'pinball.mission.radiation.run': 'Derrube os três alvos da esquerda.',
  'pinball.mission.radiation.stage2': 'Agora qualquer poço.',
  'pinball.mission.radiation.done': 'Radiação contida.',
  'pinball.mission.rescue.run': 'Acerte os alvos da esquerda.',
  'pinball.mission.rescue.stage2': 'Agora o ejetor: resgate!',
  'pinball.mission.rescue.done': 'Tripulação resgatada.',
  'pinball.mission.timeWarp2.run': 'Rampa promove, ejetor rebaixa.',
  'pinball.mission.timeWarp2.promoted': 'Promovido a {rank}.',
  'pinball.mission.timeWarp2.demoted': 'Rebaixado a {rank}.',

  'pinball.award.bonusCollected': 'Bônus: {points}',
  'pinball.award.scored': '{points} pontos',

  /* ===================== HUD ===================== */
  'pinball.a11y.blindOn': 'Modo cego ligado. Use S para varrer a mesa.',
  'pinball.a11y.blindOff': 'Modo cego desligado.',
  'pinball.demo.ask': 'Modo demonstração: escolha o seu PINBALL.DAT. O ficheiro não sai desta máquina.',
  'pinball.demo.caveat': 'Mostra a mesa e a física de 1995. Ainda não pontua, não acende luzes nem corre missões.',
  'pinball.demo.music': 'Música (opcional): escolha o seu PINBALL.MID.',
  'pinball.demo.notMidi': 'Esse ficheiro não é MIDI padrão. O PINBALL2.MID não serve.',
  'pinball.demo.failed': 'Não consegui ler esse ficheiro: {n}',
  'pinball.event.attackBumpersRaised': 'Os para-choques do centro valem mais.',
  'pinball.event.launchBumpersRaised': 'Os para-choques da rampa valem mais.',
  'pinball.event.extraBall': 'Bola extra!',
  'pinball.event.refuel': 'Tanque abastecido.',
  'pinball.hud.score': 'Pontuação: {n}',
  'pinball.objective.authored': 'Alvos por acender: {n}',
  'pinball.hud.player': 'Jogador {n}',
  'pinball.hud.balls': 'Bolas: {n}',
  'pinball.hud.gameOver': 'Fim de jogo',
  'pinball.hud.shootAgain': 'Jogue de novo',
  'pinball.hud.waiting': 'Puxe o êmbolo.',
};

export default pt;
