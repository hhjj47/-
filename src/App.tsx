import { useState, useRef, useEffect, forwardRef } from 'react';
import { motion, PanInfo, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORD_POOL, type Word, type WordCategory } from './words';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isPointInRect = (point: { x: number; y: number }, element: HTMLElement | null) => {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
};

const WordDisplay = ({ text, isCard }: { text: string; isCard?: boolean }) => {
  const match = text.match(/^(\([^)]+\))\s*(.*)$/);
  if (match) {
    if (match[2] === "쓰다") {
      return (
        <span className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <span className={cn("text-[#8b95a1] font-medium", isCard ? "text-lg" : "text-base")}>{match[1]}</span>
          <span>{match[2]}</span>
        </span>
      );
    }
    return <span>{match[2]}</span>;
  }
  return <span>{text}</span>;
};

interface ZoneProps {
  category: WordCategory;
  description: string;
  icon: string;
  textColor: string;
  hoverBg: string;
  isHovered: boolean;
  words: Word[];
}

const Zone = forwardRef<HTMLDivElement, ZoneProps>(
  ({ category, description, icon, textColor, hoverBg, isHovered, words }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col bg-white rounded-[2.5rem] shadow-[0_2px_16px_rgba(0,0,0,0.04)] transition-all duration-300 overflow-hidden",
          isHovered ? hoverBg : "",
          isHovered ? "shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-4 ring-black/5" : ""
        )}
      >
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-4xl">{icon}</span>
            <h2 className={cn("text-3xl font-bold", textColor)}>
              {category}
            </h2>
          </div>
          <p className="text-[#8b95a1] font-medium text-xl">{description}</p>
        </div>
        <div className="flex-1 p-8 pt-4 flex flex-wrap content-start gap-3 overflow-y-auto">
          <AnimatePresence>
            {words.map((word) => (
              <motion.div
                key={word.id}
                layoutId={word.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-5 py-3 bg-[#f2f4f6] rounded-2xl text-2xl font-bold text-[#333d4b]"
              >
                <WordDisplay text={word.text} isCard={false} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    );
  }
);
Zone.displayName = 'Zone';

interface DraggableCardProps {
  key?: string;
  word: Word;
  onDrag: (info: PanInfo) => void;
  onDragEnd: (info: PanInfo, word: Word) => boolean;
}

const DraggableCard = ({ word, onDrag, onDragEnd }: DraggableCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isWrong, setIsWrong] = useState(false);

  const handleDragEnd = (e: any, info: PanInfo) => {
    setIsDragging(false);
    const isCorrect = onDragEnd(info, word);
    if (!isCorrect) {
      setIsWrong(true);
      setTimeout(() => setIsWrong(false), 500);
    }
  };

  return (
    <motion.div
      layoutId={word.id}
      drag
      dragSnapToOrigin={true}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDrag={(e, info) => onDrag(info)}
      onDragEnd={handleDragEnd}
      animate={
        isWrong
          ? { x: [-10, 10, -10, 10, 0], transition: { duration: 0.4 } }
          : undefined
      }
      className={cn(
        "z-50 cursor-grab active:cursor-grabbing",
        "w-44 h-24 bg-white rounded-[1.5rem] shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
        "flex items-center justify-center transition-colors",
        isDragging ? "shadow-[0_10px_40px_rgba(0,0,0,0.12)] z-[100]" : "",
        isWrong ? "bg-red-50 text-red-500" : "text-[#191f28]"
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 1.1 }}
    >
      <span className="text-3xl font-bold tracking-tight">
        <WordDisplay text={word.text} isCard={true} />
      </span>
    </motion.div>
  );
};

export default function App() {
  const [gameWords, setGameWords] = useState<Word[]>([]);
  const [placedWords, setPlacedWords] = useState<Record<WordCategory, Word[]>>({
    어찌하다: [],
    어떠하다: [],
    무엇이다: [],
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<WordCategory | null>(null);
  const [timeLimitOption, setTimeLimitOption] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isTimeUp, setIsTimeUp] = useState(false);

  const zone1Ref = useRef<HTMLDivElement>(null);
  const zone2Ref = useRef<HTMLDivElement>(null);
  const zone3Ref = useRef<HTMLDivElement>(null);

  // Calculate which words have been placed
  const placedIds = new Set([
    ...placedWords['어찌하다'].map((w) => w.id),
    ...placedWords['어떠하다'].map((w) => w.id),
    ...placedWords['무엇이다'].map((w) => w.id),
  ]);

  // Words that are still in the bottom pool
  const unplacedWords = gameWords.filter((w) => !placedIds.has(w.id));

  useEffect(() => {
    if (isPlaying && gameWords.length > 0 && unplacedWords.length === 0) {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#3182f6', '#22c55e', '#f59e0b', '#ef4444'],
      });
    }
  }, [unplacedWords.length, isPlaying, gameWords.length]);

  useEffect(() => {
    if (isPlaying && timeLeft !== null && timeLeft > 0 && unplacedWords.length > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    } else if (isPlaying && timeLeft === 0 && unplacedWords.length > 0) {
      setIsTimeUp(true);
      setIsPlaying(false);
    }
  }, [isPlaying, timeLeft, unplacedWords.length]);

  const startGame = () => {
    const verbs = WORD_POOL.filter(w => w.category === '어찌하다').sort(() => Math.random() - 0.5);
    const adjectives = WORD_POOL.filter(w => w.category === '어떠하다').sort(() => Math.random() - 0.5);
    const nouns = WORD_POOL.filter(w => w.category === '무엇이다').sort(() => Math.random() - 0.5);

    // Pick 0 to 2 nouns randomly (max 2)
    const numNouns = Math.floor(Math.random() * 3);
    const selectedNouns = nouns.slice(0, numNouns);

    // Fill the rest with verbs and adjectives
    const remainingCount = 10 - numNouns;
    const remainingWords = [...verbs, ...adjectives].sort(() => Math.random() - 0.5);
    const selectedRemaining = remainingWords.slice(0, remainingCount);

    const selected = [...selectedNouns, ...selectedRemaining].sort(() => Math.random() - 0.5);

    setGameWords(selected);
    setPlacedWords({
      어찌하다: [],
      어떠하다: [],
      무엇이다: [],
    });
    setTimeLeft(timeLimitOption > 0 ? timeLimitOption : null);
    setIsTimeUp(false);
    setIsPlaying(true);
    setHoveredZone(null);
  };

  const handleDrag = (info: PanInfo) => {
    const point = { x: info.point.x, y: info.point.y };
    if (isPointInRect(point, zone1Ref.current)) setHoveredZone('어찌하다');
    else if (isPointInRect(point, zone2Ref.current)) setHoveredZone('어떠하다');
    else if (isPointInRect(point, zone3Ref.current)) setHoveredZone('무엇이다');
    else setHoveredZone(null);
  };

  const handleDragEnd = (info: PanInfo, word: Word) => {
    setHoveredZone(null);
    const dropPoint = { x: info.point.x, y: info.point.y };

    let targetCategory: WordCategory | null = null;

    if (isPointInRect(dropPoint, zone1Ref.current)) targetCategory = '어찌하다';
    else if (isPointInRect(dropPoint, zone2Ref.current)) targetCategory = '어떠하다';
    else if (isPointInRect(dropPoint, zone3Ref.current)) targetCategory = '무엇이다';

    if (targetCategory === word.category) {
      setPlacedWords((prev) => ({
        ...prev,
        [targetCategory!]: [...prev[targetCategory!], word],
      }));
      return true;
    }

    return false;
  };

  return (
    <div className="h-screen w-screen bg-[#f2f4f6] flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="px-10 py-8 flex justify-between items-center z-20">
        <div>
          <h1 className="text-4xl font-bold text-[#191f28] tracking-tight">문장의 짜임</h1>
          <p className="text-[#8b95a1] font-medium mt-2 text-xl">알맞은 방으로 단어를 드래그해보세요</p>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={timeLimitOption}
            onChange={(e) => setTimeLimitOption(Number(e.target.value))}
            className="appearance-none pl-5 pr-12 py-4 rounded-2xl border-none bg-white font-bold text-lg text-[#333d4b] shadow-sm outline-none cursor-pointer bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23333d4b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[position:right_1rem_center]"
          >
            <option value={0}>시간 제한 없음</option>
            <option value={20}>20초</option>
            <option value={30}>30초</option>
            <option value={60}>60초</option>
            <option value={90}>90초</option>
          </select>
          {isPlaying && timeLeft !== null && (
            <div className={cn(
              "bg-white px-6 py-4 rounded-2xl font-bold text-xl shadow-sm flex items-center gap-2",
              timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-[#333d4b]"
            )}>
              ⏱️ {timeLeft}초
            </div>
          )}
          {isPlaying && (
            <div className="bg-white px-6 py-4 rounded-2xl font-bold text-xl text-[#333d4b] shadow-sm">
              진행도 <span className="text-[#3182f6] ml-2">{placedIds.size}</span> <span className="text-[#8b95a1] font-normal">/ {gameWords.length}</span>
            </div>
          )}
          <button
            onClick={startGame}
            className="px-8 py-4 bg-[#3182f6] text-white rounded-2xl font-bold text-xl hover:bg-[#1b64da] transition-colors shadow-sm active:scale-95"
          >
            {isPlaying ? '새 게임 시작' : '게임 시작'}
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 flex flex-col relative px-10 pb-10 gap-8">
        {/* Top 60%: 3 Zones (분면) */}
        <div className="h-[55%] grid grid-cols-3 gap-8 relative z-10">
          <Zone
            category="어찌하다"
            description="행동, 움직임을 나타내는 말"
            icon="🏃‍♂️"
            textColor="text-[#3182f6]"
            hoverBg="bg-blue-50/50"
            isHovered={hoveredZone === '어찌하다'}
            ref={zone1Ref}
            words={placedWords['어찌하다']}
          />
          <Zone
            category="어떠하다"
            description="상태, 성질을 나타내는 말"
            icon="✨"
            textColor="text-[#22c55e]"
            hoverBg="bg-green-50/50"
            isHovered={hoveredZone === '어떠하다'}
            ref={zone2Ref}
            words={placedWords['어떠하다']}
          />
          <Zone
            category="무엇이다"
            description="이름, 정체를 나타내는 말"
            icon="🍎"
            textColor="text-[#f59e0b]"
            hoverBg="bg-orange-50/50"
            isHovered={hoveredZone === '무엇이다'}
            ref={zone3Ref}
            words={placedWords['무엇이다']}
          />
        </div>

        {/* Bottom 45%: Card Pool */}
        <div className="h-[45%] relative z-20">
          {isTimeUp ? (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white px-16 py-12 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center pointer-events-auto flex flex-col items-center"
              >
                <div className="text-6xl mb-6">⏰</div>
                <h2 className="text-4xl font-bold text-[#191f28] mb-4">시간 초과!</h2>
                <p className="text-2xl text-[#8b95a1] font-medium mb-10">
                  아쉽네요. 다시 도전해보세요!
                </p>
                <button
                  onClick={startGame}
                  className="px-10 py-5 bg-[#3182f6] text-white rounded-2xl font-bold text-2xl hover:bg-[#1b64da] transition-colors shadow-sm active:scale-95 w-full"
                >
                  다시 하기
                </button>
              </motion.div>
            </div>
          ) : isPlaying ? (
            unplacedWords.length > 0 ? (
              <div className="w-full h-full flex flex-wrap justify-center content-start gap-6 pt-4">
                {unplacedWords.map((word) => (
                  <DraggableCard
                    key={word.id}
                    word={word}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className="bg-white px-16 py-12 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.08)] text-center pointer-events-auto flex flex-col items-center"
                >
                  <div className="text-6xl mb-6">🎉</div>
                  <h2 className="text-4xl font-bold text-[#191f28] mb-4">참 잘했어요!</h2>
                  <p className="text-2xl text-[#8b95a1] font-medium mb-10">
                    모든 단어를 올바르게 분류했습니다.
                  </p>
                  <button
                    onClick={startGame}
                    className="px-10 py-5 bg-[#3182f6] text-white rounded-2xl font-bold text-2xl hover:bg-[#1b64da] transition-colors shadow-sm active:scale-95 w-full"
                  >
                    다시 하기
                  </button>
                </motion.div>
              </div>
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white px-10 py-8 rounded-[2rem] shadow-[0_4px_20px_rgba(0,0,0,0.04)] text-center">
                <p className="text-2xl text-[#333d4b] font-medium">
                  우측 상단의 <span className="text-[#3182f6] font-bold">게임 시작</span> 버튼을 눌러주세요
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
