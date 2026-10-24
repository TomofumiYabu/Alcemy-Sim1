import { useState } from 'react';
import { equipmentTypes, items } from '../game/content';
import type { Equipment, ItemId } from '../game/types';
import cauldron from '../assets/ui2/cauldron.webp';
import herb from '../assets/ui2/herb.webp';
import iris from '../assets/ui2/iris.webp';
import potion from '../assets/ui2/potion.webp';
import water from '../assets/ui2/water.webp';
import workshop from '../assets/ui2/workshop-night.webp';

const itemArtwork: Partial<Record<ItemId, string>> = { herb, water, potion };

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
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`artwork ${className}`}
      data-art={name}
      data-failed={failed || !src}
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
          onError={() => setFailed(true)}
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
  return (
    <Artwork
      src={iris}
      fallback="I"
      name="iris"
      className={`iris-portrait ${className}`}
    />
  );
}
export function EquipmentArtwork({ equipment }: { equipment: Equipment }) {
  if (equipment.kind !== 'cauldron')
    return (
      <span className="equipment-symbol" aria-hidden="true">
        {equipmentTypes[equipment.kind].icon}
      </span>
    );
  return (
    <span
      className="cauldron-artwork"
      data-active={!!equipment.job}
      aria-hidden="true"
    >
      <Artwork
        src={cauldron}
        fallback={equipmentTypes.cauldron.icon}
        name="cauldron"
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
