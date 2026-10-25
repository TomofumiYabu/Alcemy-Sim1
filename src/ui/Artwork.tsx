import { useState } from 'react';
import { equipmentTypes, items } from '../game/content';
import type {
  AdventurerId,
  DestinationId,
  Equipment,
  ItemId,
} from '../game/types';
import cauldron from '../assets/ui2/cauldron.webp';
import herb from '../assets/ui2/herb.webp';
import iris from '../assets/ui2/iris.webp';
import potion from '../assets/ui2/potion.webp';
import water from '../assets/ui2/water.webp';
import workshop from '../assets/ui2/workshop-night.webp';
import rowan from '../assets/delivery/rowan.webp';
import still from '../assets/delivery/still.webp';
import crystal from '../assets/delivery/crystal.webp';
import extract from '../assets/delivery/extract.webp';
import mana from '../assets/delivery/mana.webp';
import forest from '../assets/delivery/forest.webp';
import ruins from '../assets/delivery/ruins.webp';

const itemArtwork: Record<ItemId, string> = {
  herb,
  water,
  potion,
  crystal,
  extract,
  mana,
};

/** Pictures supplement nearby names and state text; failed images keep a usable fallback. */
export function Artwork({
  src,
  fallback,
  name,
  className = '',
}: {
  src?: string | undefined;
  fallback: string;
  name: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = !src || failedSource === src;
  return (
    <span
      className={`artwork ${className}`}
      data-art={name}
      data-failed={failed}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width="160"
          height="160"
          decoding="async"
          draggable={false}
          onError={() => setFailedSource(src)}
        />
      ) : (
        <span className="artwork-fallback">{fallback}</span>
      )}
    </span>
  );
}
export function ItemArtwork({ item }: { item: ItemId }) {
  return (
    <Artwork
      src={itemArtwork[item]}
      fallback={items[item].icon}
      name={item}
      className="item-artwork"
    />
  );
}
export function IrisPortrait({ className = '' }: { className?: string }) {
  return <CharacterPortrait id="iris" className={className} />;
}
export function CharacterPortrait({
  id,
  className = '',
}: {
  id: AdventurerId;
  className?: string;
}) {
  return (
    <Artwork
      src={id === 'iris' ? iris : rowan}
      fallback={id === 'iris' ? 'I' : 'R'}
      name={id}
      className={`iris-portrait portrait-${id} ${className}`}
    />
  );
}
export function EquipmentArtwork({ equipment }: { equipment: Equipment }) {
  return (
    <span
      className={`equipment-artwork ${equipment.kind}-artwork`}
      data-active={!!equipment.job}
      aria-hidden="true"
    >
      <Artwork
        src={equipment.kind === 'cauldron' ? cauldron : still}
        fallback={equipmentTypes[equipment.kind].icon}
        name={equipment.kind}
      />
      {equipment.job && (
        <>
          <span className="cauldron-liquid">
            <i />
            <i />
            <i />
          </span>
          <span className="cauldron-fire" />
        </>
      )}
    </span>
  );
}
export function DestinationArtwork({
  destination,
}: {
  destination: DestinationId;
}) {
  return (
    <Artwork
      src={destination === 'forest' ? forest : ruins}
      fallback={destination === 'forest' ? '♧' : '◇'}
      name={destination}
      className="destination-artwork"
    />
  );
}
export function RoomArtwork() {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="room-backdrop"
      data-art="workshop"
      data-failed={failed}
      aria-hidden="true"
    >
      {!failed && (
        <img
          src={workshop}
          alt=""
          width="1280"
          height="853"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
