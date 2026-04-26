
import { useState } from "react";

type Player = "X" | "O";
type Cell = Player | null;

const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6],
];

function getWinner(b: Cell[]): Player | null {
    for (const [a,b1,c] of lines) {
        if (b[a] && b[a] === b[b1] && b[a] === b[a] === b[c]) return b[a];
    }
    return null;
}

export default function TicTacToe() {
    const [board, setBoard] = useState<Cell[]>(array(9).fill(null));
    const [turn, setTurn] =
}
