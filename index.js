// https://webaudio.github.io/web-midi-api/#a-simple-loopback
// https://www.keithmcmillen.com/blog/making-music-in-the-browser-web-midi-api/
// http://tangiblejs.com/posts/web-midi-music-and-show-control-in-the-browser
// https://www.toptal.com/web/creating-browser-based-audio-applications-controlled-by-midi-hardware

let vvideo = document.querySelector('video')
let monitor = document.querySelector('[data-monitor]')
let midi = null
let register = {}
let registrationMode = false
let randomMode = false
let cutoffMode = false
let cutoffTime = 1000
let maxVolume = 0.5

/* Utilities */
function debounce(func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};


function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}


/* Midi */
function onMIDIMessage(event) {
  let data = event.data,
    cmd = data[0] >> 4,
    channel = data[0] & 0xf,
    type = data[0] & 0xf0,
    note = data[1],
    velocity = data[2]
  
   console.log({cmd, channel, type, note, velocity})
   if(monitor) {
     monitor.innerHTML = `
      cmd: ${cmd}<br>
      channel: ${channel}<br>
      type: ${type}<br>
      note: ${note}<br>
      velocity: ${velocity}<br>
      registrationMode: ${registrationMode}
     `
   }

  // Pads with CC enabled
  if(cmd === 11) {
    /*
    
    [24 ] [25 ] [26 ] [27 ]
    [20 ] [21 ] [22 ] [23 ]

    [Reg] [Ran] [Cut ] [   ]
    [ > ] [   ] [<< ] [ >>]

    */
    if(note === 20) {
      // Play/Pause
      vvideo.paused ? vvideo.play() : vvideo.pause()

    } else if(note === 22) {
      // Seek bwd 1 sec
      vvideo.currentTime = vvideo.currentTime - 1

    } else if(note === 23) {
      // Seek fwd 1 sec
      vvideo.currentTime = vvideo.currentTime + 1

    } else if(note === 24) {
      // Toggle registration mode
      registrationMode = !registrationMode

    } else if(note === 25) {
      // Toggle random mode
      randomMode = !randomMode

    } else if(note === 26) {
      // Toggle random mode
      cutoffMode = !cutoffMode
    }
  }

  // Stick
  if(cmd === 14) {
    if (velocity < 64) {
      pbr = lerp(0,-2.5,velocity/64)
    } else {
      pbr = lerp(0,2.5,(velocity-64)/64)
    }

    vvideo.playbackRate = pbr
    console.log(pbr)
  }

  // Piano keys
  if(cmd === 9) {
    if(cutoffMode) {
      vvideo.play()
      setTimeout(()=> {
        vvideo.pause()
      }, cutoffTime)
    }

    // if middle C
    if(note >= 44 && note <= 72) {
      if(randomMode) {
        // Assign next note to random duration
        let randomSecs = Math.random() * vvideo.duration
        register[note] = randomSecs
        vvideo.currentTime = randomSecs
        randomMode = false
      
      // If registering 
      } else if(registrationMode) {
        register[note] = vvideo.currentTime
        registrationMode = !registrationMode

      // If exists in register
      } else if(register[note]) {
        // Play registered note
        vvideo.currentTime = register[note]
        vvideo.volume = Math.abs((velocity / 127) - maxVolume)

      } else {
        // Use default note
        let dur = vvideo.duration
        let alpha = (note - 44) / 28
        let time = Math.round(lerp(0, dur, alpha))
        console.log(time)
        vvideo.currentTime = time
        vvideo.volume = Math.abs((velocity / 127) - maxVolume)
      }
    }
  }

  // Pause on release, when cutoffMode is off
  // if(cmd === 8 && type === 128 && !cutoffMode) {
  //   vvideo.pause()
  // }
  // // Play on press, when cutoffMode is off
  // if(cmd === 9 && type == 144 && !cutoffMode) {
  //   vvideo.play()
  // }

  // K1 dial
  if(cmd === 11 && note === 1) {
    pbr = lerp(0.05,2,velocity/127)

    vvideo.playbackRate = pbr
    console.log(pbr)
  }

  // K2 dial
  if(cmd === 11 && note === 2) {
    let cur = lerp(0,vvideo.duration,velocity/127)
    vvideo.currentTime = cur
    console.log(cur)
  }

  // k3 dial
  if(cmd === 11 && note === 3) {
    cutoffTime = lerp(100,11000,velocity/127)
  }
}

function onMIDISuccess(midiAccess) {
  midi = midiAccess

  // listen for connect/disconnect message
  midi.onstatechange = onStateChange

  let inputs = midi.inputs.values()
  for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
    input.value.addEventListener('midimessage', debounce(onMIDIMessage, 2))
  }
}

function onMIDIFailure(msg) {
  console.log('Failed to get MIDI access', msg)
}

function onStateChange(event) {
  console.log(event.port)
}

function handleKeyDown(event) {
  if(event.key === "Shift") {
    registrationMode = true
  }
}


function handleKeyUp(event) {
  if(event.key === "Shift") {
    registrationMode = false
  }
}

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure)
window.addEventListener('keydown', debounce(handleKeyDown, 10))
window.addEventListener('keyup', debounce(handleKeyUp, 10))
