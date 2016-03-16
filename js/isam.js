var gcounts = {
    recursion_level: 0,
    recursion_depth: 64
};

var esd = {
    events: [],
    fid: function (id){
        return this.events.find(function(event){return event.id == id;});
    },
    initiating: function () {
        return this.events.find(function(event){return event.type == "INITIATING";});
    },
    outcomes: function () {
        return this.events.filter(function(event){return event.type == "END";});
    },
    barriers: function () {
        return this.events.filter(function(event){return event.type == "PIVOTAL";});
    },
    calculate: function myself (event, freq, prb){
        console.log("recursion level:"+gcounts.recursion_level);
        console.log(event);
        console.log("f:"+freq);
        console.log("p:"+prb);
        if (gcounts.recursion_level++ > gcounts.recursion_depth) return; //safety check to avoid stack issues
        if (event == null || event == undefined){ //find starting point(s)
            console.log("looking for INITIATING event");
            myself.call(this, this.initiating(), 1, 1);
        } else if (event.type == "END" && event.outcome == "NEGATIVE") {
            event._frequency = freq;
            console.log("Crash:"+event.frequency);
            return;
        } else if (event.type == "END" && event.outcome == "POSITIVE") {
            event._frequency = freq/prb*(1.0-prb);
            console.log("Continue flight:"+event.frequency);
            return;
        } else if (event.type == "INITIATING"){
            console.log("Found INITIATING event");
            console.log(event.childIds);
            for (var i = 0; i < event.childIds.length; i++){
                console.log(event.childIds[i]);
                myself.call(this, this.fid(event.childIds[i]), event.frequency, 1);
            }
        } else if (event.type == "PIVOTAL"){
            for (var i = 0; i < event.childIds.length; i++){
                event.frequency = freq*event.probability;
                myself.call(this, this.fid(event.childIds[i]), event.frequency, event.probability);
            }
        }
    }
};


$(document).ready(function() {
    $.ajax({
        url: "https://ape-3.saabsensis.com/isam-webservice/safety/v1/eventSequences/45",
        xhrFields: {withCredentials: true}
    }).then(function(data) {
        esd.events = data.events;
//        console.log(esd.fid(440));
       esd.calculate();
       console.log(esd.outcomes());
       $('.greeting-id').append(data.id);
       $('.greeting-content').append(data.description);
    });
});