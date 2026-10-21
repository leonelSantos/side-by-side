// Shared labels and small renderers for workouts, foods and together-events

export const WORKOUT_CATEGORIES = ['strength', 'cardio', 'hiit', 'yoga', 'mobility'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const FOOD_CATEGORIES = ['cook', 'takeout', 'restaurant'];

export const KIND_ICON = { workout: '🏋️', dinner: '🍽️', hangout: '💛' };
export const KIND_LABEL = { workout: 'Workout', dinner: 'Dinner', hangout: 'Hang out' };

export const FOOD_CATEGORY_LABEL = { cook: 'Cook at home', takeout: 'Takeout', restaurant: 'Eat out' };

export function eventTitle(ev) {
  return ev.title || ev.workout?.name || ev.food?.name || KIND_LABEL[ev.kind];
}

export const workoutMeta = (w) => `${w.category} · ${w.duration_min} min · ${w.difficulty}`;

export const foodMeta = (f) =>
  [FOOD_CATEGORY_LABEL[f.category], f.cuisine, f.prep_min ? `${f.prep_min} min` : null].filter(Boolean).join(' · ');

export function WorkoutDetail({ item }) {
  return (
    <>
      {item.description && <p>{item.description}</p>}
      {item.exercises?.length > 0 && (
        <ol className="exercises">
          {item.exercises.map((x, i) => (
            <li key={i}><span>{x.name}</span>{x.detail && <em>{x.detail}</em>}</li>
          ))}
        </ol>
      )}
    </>
  );
}

export function FoodDetail({ item }) {
  return item.description ? <p>{item.description}</p> : null;
}
