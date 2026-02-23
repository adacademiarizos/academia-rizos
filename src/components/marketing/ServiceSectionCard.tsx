type ServiceCardProps = {
    title: string;
    desc: string;
    duration: string;
    from: string;
    href: string;
    imgUri: string;
}


function ServiceSectionCard({ title, desc, duration, from, imgUri }: ServiceCardProps) {
  return (
    <div className="rounded-3xl border  w-screen h-screen shadow-sm backdrop-blur-md transition p-5 pt-20 md:p-10 md:pt-24">
      <div className="w-full h-full p-4 rounded-2xl flex flex-col justify-end" style={{backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.8), rgba(0, 0, 0, 0.8)), url(${imgUri})`, backgroundSize: 'cover', backgroundPosition: 'center'}} >
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="font-main text-ap-copper font-bold text-4xl ">{title}</div>
                <p className="mt-3 text-sm text-zinc-200">{desc}</p>

                <div className="mt-1 text-xs text-zinc-300">
                    {duration} · Desde {from}
                </div>
                </div>
            </div>
      </div>
    </div>
  );
}


export default ServiceSectionCard;