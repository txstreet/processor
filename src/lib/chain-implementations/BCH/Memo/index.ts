import ChainImplementation from '../../implementation'; 
import { decodeHex, swapEndian } from '../../../../lib/utilities';

class Memo extends ChainImplementation {
    async init(): Promise<ChainImplementation> {
        return this;
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        for(let i = 0; i < transaction.asmArrays.length; i++) {
            const asmArray = transaction.asmArrays[i];
            const op_return = asmArray[0] === "OP_RETURN";
            if(!op_return) continue 
            const code = asmArray[1]; 
            const links = []; 

            let handled = false; 

            switch(code) {
                case "6d01":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'profile_edit';
                    transaction.extras.houseContent = '<i>Name set: ' + decodeHex(asmArray[2]) + '</i>'; //Set name
                    break;
                case "6d02":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'post';
                    transaction.extras.houseContent =  decodeHex(asmArray[2]); //Post memo
                    links.push({l:'https://memo.cash/post/' + transaction.hash});
                    transaction.extras.showBubble = true;
                    break;
                case "6d03":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'post';
                    transaction.extras.houseContent = decodeHex(asmArray[3]); //reply to memo, first 70 chars are hash
                    links.push({l:'https://memo.cash/post/' + transaction.hash});
                    transaction.extras.showBubble = true;
                    break;
                case "6d04":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'heart';
                    links.push({l:'https://memo.cash/post/' + swapEndian(asmArray[2])});
                    transaction.extras.houseContent = '<i>Post liked</i>';
                    break;
                case "6d05":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'profile_edit';
                    transaction.extras.houseContent = '<i>Profile text set: ' + decodeHex(asmArray[2]) + '</i>';
                    break;
                case "6d06":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'follow';
                    transaction.extras.houseContent = '<i>Profile Follow</i>';
                    break;
                case "6d07":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'unfollow';
                    transaction.extras.houseContent = '<i>Profile Unfollow</i>';
                    break;
                case "6d0a":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'profile_edit';
                    transaction.extras.houseContent = '<i>Picture set: ' + decodeHex(asmArray[2]) + '</i>'; //set profile picture
                    // transaction.extras.link = utils.decodeHex(asmArray[2]);
                    break;
                case "6d0b":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'repost';
                    transaction.extras.houseContent = '<i>Repost</i>';
                    break;
                case "6d0c":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'post';
                    transaction.extras.houseContent =  decodeHex(asmArray[3]); //post topic message, seperated by 1e (maybe)
                    links.push({l:'https://memo.cash/post/' + transaction.hash});
                    transaction.extras.showBubble = true;
                    break;
                case "6d0d":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'follow';
                    transaction.extras.houseContent = '<i>Followed Topic: ' + decodeHex(asmArray[2]) + '</i>'; //topic follow
                    break;
                case "6d0e":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'unfollow';
                    transaction.extras.houseContent = '<i>Unfollowed Topic:' + decodeHex(asmArray[2]) + '</i>'; //topic unfollow
                    break;
                case "6d10":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'poll';
                    transaction.extras.houseContent = '<i>New poll</i>'; //create poll
                    break;
                case "6d13":
                    handled = true;
                    transaction.extras.houseTween = 'poll';
                    transaction.extras.houseContent = '<i>New poll option</i>'; //add poll option
                    break;
                case "6d14":
                    handled = true;
                    if(!transaction.extras) transaction.extras = {};
                    transaction.extras.houseTween = 'poll';
                    transaction.extras.houseContent = '<i>Poll vote</i>'; //poll vote
                    break;
            }

            if(handled){
                transaction.house = "memo"; 
                links.push({l:'https://memo.cash/profile/' + transaction.inputs[0].address, i:'profile'});
                if(links.length) transaction.extras.l = links;
                return true;
            }
        }
        return false; 
    }
}

export default new Memo('BCH'); 