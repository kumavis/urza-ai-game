const fetch = globalThis.fetch || require('node-fetch')

const cardCountTable = new Map([
  [1, 9],
  [2, 15],
  [3, 11],
  [4, 7],
  [5, 3],
  [6, 4],
])
const manaCostSymbol = new Map([
  ['red', '{R}'],
  ['green', '{G}'],
  ['black', '{B}'],
  ['white', '{W}'],
  ['blue', '{U}'],
])

const savedDeck = localStorage.getItem('deck')

let playerState = {
  deck: savedDeck ? JSON.parse(savedDeck) : require('./default-deck.json'),
  hand: [],
  playfield: [],
  graveyard: [],
  loading: false,
}

startGame()


function startGame() {
  render()
}

function render () {
  document.body.innerHTML = playerState.loading ? 'loading...' : (`
    ${generateDeckButton(playerState)}
    ${renderDeck(playerState)}
    ${drawCardButton(playerState)}
    ${renderCardSet('hand', playerState.hand, (card) => renderCardActions(card, 'hand', playerState))}
    ${renderCardSet('playfield', playerState.playfield, (card) => renderCardActions(card, 'playfield', playerState))}
    ${renderCardSet('discard', playerState.graveyard, (card) => renderCardActions(card, 'graveyard', playerState))}
  `)
}

function generateDeckButton(playerState) {
  globalThis.generateDeck = async () => {
    playerState.loading = true
    render()
    const deck = await getDeck()
    const deckString = JSON.stringify(deck)
    console.log(deckString)
    localStorage.setItem('deck', deckString)
    playerState.deck = deck
    playerState.hand = []
    playerState.loading = false
    render()
  }
  return (`
    <button onclick="generateDeck()">generate deck</button>
  `)
}

function drawCardButton(playerState) {
  globalThis.drawCard = async () => {
    console.log('draw card')
    const { hand, deck } = playerState
    moveCard(deck[deck.length - 1].id, deck, hand)
    render()
  }
  return (`
    <button onclick="drawCard()">draw card</button>
  `)
}

function renderDeck(playerState) {
  return (`
    <div>deck: ${playerState.deck.length}</div>
  `)
}

function renderCardSet (label, cards, contextActions) {
  return (`
  <div>${label}: ${cards.length}</div>
  <ul>
    ${cards.map(card => {
      return (`
        <li>
        ${renderCard(card)}
        ${contextActions(card, playerState)}
        </li>
      `)
    }).join('\n')}
  </ul>
`)
}

function renderCard (card) {
  const { name, types, manaCost, text, power, toughness, flavorText, rarity } = card
  return (`
  <div>
    ${name || 'nameless?'}
    ${manaCost}
    ${types} (${rarity})
    <pre>
      ${text}
      ${power !== '' ? `${power}/${toughness}` : ''}
      "${flavorText}"
    </pre>
  </div>
  `)
}

function renderCardActions (card, contextLocation, playerState) {
  globalThis.cardActionMove = (cardId, fromName, toName, push = true) => {
    console.log('card action', cardId, fromName, toName, push)
    moveCard(cardId, playerState[fromName], playerState[toName], push)
    render()
  }
  return [
    'move to:',
    contextLocation ==='hand' ? null : `<button onclick="cardActionMove('${card.id}', '${contextLocation}', 'hand')">hand</button>`,
    contextLocation ==='playfield' ? null : `<button onclick="cardActionMove('${card.id}', '${contextLocation}', 'playfield')">playfield</button>`,
    contextLocation ==='graveyard' ? null : `<button onclick="cardActionMove('${card.id}', '${contextLocation}', 'graveyard')">graveyard</button>`,
    contextLocation ==='deck' ? null : `<button onclick="cardActionMove('${card.id}', '${contextLocation}', 'deck')">top of deck</button>`,
    contextLocation ==='deck' ? null : `<button onclick="cardActionMove('${card.id}', '${contextLocation}', 'deck', false)">bottom of deck</button>`,
  ].filter(Boolean).join('\n')
}

function moveCard (cardId, currentLocation, targetLocation, push = true) {
  const cardIndex = currentLocation.findIndex(card => card.id === cardId)
  const card = currentLocation[cardIndex]
  currentLocation.splice(cardIndex, 1)
  if (push) {
    targetLocation.push(card)
  } else {
    targetLocation.unshift(card)
  }
}

async function getDeck () {
  const deckParams = generateDeckParams()
  const deck = await Promise.all(deckParams.map(async (cardArgs) => {
    const card = await getCard(cardArgs)
    card.id = Math.random().toString().slice(2)
    // console.log(cardArgs, card)
    return card
  }))
  return deck
}

function generateDeckParams () {
  const deckPalette = ['red']
  const deckParams = []
  cardCountTable.forEach((count, cardTotalCost) => {
    for (let i = 0; i < count; i++) {
      const manaCost = randomCostFromTotalCost(cardTotalCost, deckPalette)
      // console.log(cardTotalCost, manaCost, manaCostToString(manaCost))
      deckParams.push({
        manaCost: manaCostToString(manaCost),
      })
    }
  })
  return deckParams
}

function randomCostFromTotalCost (cardTotalCost, deckPalette) {
  const primaryColor = deckPalette[0]
  const manaCost = new Map()
  for (let i = 0; i < cardTotalCost; i++) {
    const color = randomChance(0.3) ? primaryColor : 'colorless'
    const colorCost = manaCost.get(color) || 0
    manaCost.set(color, colorCost + 1)
  }
  return manaCost
}


function randomChance (chance) {
  return Math.random() < chance
}

function manaCostToString(manaCost) {
  let costString = ''
  if (manaCost.has('colorless')) {
    costString += `{${manaCost.get('colorless')}}`
  }
  ;[...manaCost.keys()]
    .filter(color => color !== 'colorless')
    .forEach(color => {
      costString += Array(manaCost.get(color))
        .fill(manaCostSymbol.get(color))
        .join('')
    })
  return costString
}

async function getCard (cardArgs = {}) {
  const presets = Object.assign({
    "name":"",
    "manaCost":"",
    "types":"",
    "subtypes":"",
    "text":"",
    "power":"",
    "toughness":"",
    "flavorText":"",
    "rarity":"",
    "loyalty":"",
    "url":"",
    "basic_land":"",
  }, cardArgs)
  const presetString = JSON.stringify(presets)
  const res = await fetch(`https://backend-dot-valued-sight-253418.ew.r.appspot.com/api/v1/card?presets=${presetString}`, { 'method': 'GET'});
  const json = await res.json();
  return json
}
