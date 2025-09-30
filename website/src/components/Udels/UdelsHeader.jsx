import NumberInput from '@src/repl/components/NumberInput';

export default function UdelsHeader(Props) {
  const { numWindows, setNumWindows } = Props;

  return (
    <header id="header" className="flex text-white  z-[100] text-lg select-none bg-black">
      <div className="px-4 items-center gap-2  flex space-x-2 md:pt-0 select-none">
        <h1 onClick={() => {}} className={'text-l cursor-pointer flex gap-4'}>
          <div className={'mt-[1px] cursor-pointer'}>🦄</div>

          <div>
            <span className="font-mono text-">SWITCH ANGEL</span>
          </div>
        </h1>
        <NumberInput value={numWindows} setValue={setNumWindows} />
      </div>
    </header>
  );
}
